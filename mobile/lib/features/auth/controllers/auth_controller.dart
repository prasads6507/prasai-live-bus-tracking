import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../data/providers.dart';
import '../../../../data/repositories/auth_repo.dart';

// Current auth state
// (The authStateProvider and selectedCollegeIdProvider are now in providers.dart)

class AuthController extends StateNotifier<AsyncValue<void>> {
  final AuthRepository _authRepository;
  final Ref _ref;
  static const String _collegeIdKey = 'selected_college_id';
  
  // Track token refresh listener to prevent leaks
  StreamSubscription? _tokenRefreshSubscription;
  // Track current session info for cleanup
  String? _currentUid;
  String? _currentRole;
  String? _currentCollegeId;

  AuthController(this._authRepository, this._ref) : super(const AsyncValue.data(null));

  Future<void> signIn({
    required String email,
    required String password,
    required Map<String, dynamic> college,
  }) async {
    final collegeSlug = college['slug'];
    final collegeName = college['collegeName'];
    
    state = const AsyncValue.loading();
    try {
      // 1. Firebase Sign In
      final loginResult = await _authRepository.signIn(email, password, collegeSlug);
      final userCredential = loginResult['credential'];
      final jwtToken = loginResult['token'];
      final user = userCredential.user;

      if (user == null) {
        throw 'Authentication failed. Please check your credentials.';
      }

      // 2. Find college by slug
      final collegeId = await _authRepository.findCollegeIdBySlug(collegeSlug);
      if (collegeId == null) {
        await _authRepository.signOut();
        throw 'College ID "$collegeSlug" not found.';
      }

      // 3. Verify user belongs to this college
      final userDoc = await _authRepository.getUserInCollege(collegeId, user.uid);
      if (!userDoc.exists) {
        await _authRepository.signOut();
        throw 'Access denied. You are not registered with $collegeSlug.';
      }

      // 4. Success - store for session and persist
      _ref.read(selectedCollegeIdProvider.notifier).state = collegeId;
      _ref.read(selectedCollegeProvider.notifier).state = {
        'collegeId': collegeId,
        'slug': collegeSlug,
        'collegeName': collegeName,
      };

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_collegeIdKey, collegeId);
      await prefs.setString('college_slug', collegeSlug);
      await prefs.setString('college_name', collegeName);
      if (jwtToken != null) {
        await prefs.setString('auth_token', jwtToken);
      }
      
      // 5. Register FCM Token — pass collegeId and user role so it is saved in the correct collection
      final userData = userDoc.data() as Map<String, dynamic>?;
      final userRole = userData?['role'] ?? 'student';
      await _registerFcmToken(user.uid, collegeId, userRole);
      
      state = const AsyncValue.data(null);
    } catch (e, st) {
      // Ensure we are signed out if validation fails
      await _authRepository.signOut();
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> signOut() async {
    state = const AsyncValue.loading();
    try {
      // Clear FCM token from Firestore BEFORE signing out
      await _clearFcmToken();
      
      // Cancel token refresh listener
      _tokenRefreshSubscription?.cancel();
      _tokenRefreshSubscription = null;
      
      await _authRepository.signOut();
      _ref.read(selectedCollegeIdProvider.notifier).state = null;
      _ref.read(selectedCollegeProvider.notifier).state = null;
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_collegeIdKey);
      await prefs.remove('college_slug');
      await prefs.remove('college_name');
      await prefs.remove('auth_token');
      
      _currentUid = null;
      _currentRole = null;
      _currentCollegeId = null;
      
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
  
  /// Clear FCM token from Firestore to prevent notifications leaking to next user
  Future<void> _clearFcmToken() async {
    if (_currentUid == null) return;
    try {
      final collection = (_currentRole?.toLowerCase() == 'driver' || 
                          _currentRole?.toLowerCase() == 'admin' || 
                          _currentRole?.toLowerCase() == 'user')
          ? 'users'
          : 'students';
      await FirebaseFirestore.instance
          .collection(collection)
          .doc(_currentUid)
          .update({'fcmToken': FieldValue.delete()});
      debugPrint('[Auth] Cleared FCM token for $_currentUid from $collection');
    } catch (e) {
      debugPrint('[Auth] Error clearing FCM token: $e');
    }
  }

  Future<void> registerFcmTokenForSession(String uid, String collegeId, String role) => 
      _registerFcmToken(uid, collegeId, role);

  // ─────────────────────────────────────────────────────────────────────────
  // BUG FIX: _registerFcmToken / _saveFcmToken
  //
  // Previous code saved ONLY the FCM token to students/{uid}, which created
  // fake student records for drivers.
  // Fix: Save to 'users' if role is DRIVER/ADMIN, else 'students'.
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> _registerFcmToken(String uid, String collegeId, String role) async {
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      
      // Store session info for cleanup
      _currentUid = uid;
      _currentRole = role;
      _currentCollegeId = collegeId;
      
      final token = await messaging.getToken();
      if (token != null) {
        await _saveFcmToken(uid, token, collegeId, role);
      }

      // Cancel previous listener to prevent leaks
      _tokenRefreshSubscription?.cancel();
      _tokenRefreshSubscription = messaging.onTokenRefresh.listen((newToken) async {
        await _saveFcmToken(uid, newToken, collegeId, role);
      });

    } catch (e) {
      debugPrint("Error registering FCM token: $e");
    }
  }

  Future<void> _saveFcmToken(String uid, String token, String collegeId, String role) async {
    // Save to the collection based on role to prevent "Student" redirect for drivers
    final collection = (role.toLowerCase() == 'driver' || role.toLowerCase() == 'admin' || role.toLowerCase() == 'user') 
        ? 'users' 
        : 'students';
    final ref = FirebaseFirestore.instance.collection(collection).doc(uid);
    try {
      // Use update to avoid overwriting existing fields like role/name
      await ref.update({
        'fcmToken': token,
        'collegeId': collegeId,
      });
      debugPrint("FCM Token updated for $uid in $collection (college: $collegeId)");
    } catch (updateErr) {
      // If doc doesn't exist, we must use set with merge
      try {
        await ref.set({
          'fcmToken': token,
          'collegeId': collegeId,
          'role': role,
        }, SetOptions(merge: true));
        debugPrint("FCM Token set (new doc) for $uid in $collection (college: $collegeId)");
      } catch (setErr) {
        debugPrint("Error saving FCM token: $updateErr | $setErr");
      }
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
  return AuthController(ref.watch(authRepositoryProvider), ref);
});
