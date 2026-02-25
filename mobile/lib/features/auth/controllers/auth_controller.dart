import 'package:cloud_firestore/cloud_firestore.dart';
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
      
      // 5. Register FCM Token — pass collegeId so it is saved alongside the token
      await _registerFcmToken(user.uid, collegeId);
      
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
      await _authRepository.signOut();
      _ref.read(selectedCollegeIdProvider.notifier).state = null;
      _ref.read(selectedCollegeProvider.notifier).state = null;
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_collegeIdKey);
      await prefs.remove('college_slug');
      await prefs.remove('college_name');
      await prefs.remove('auth_token');
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // BUG FIX: _registerFcmToken / _saveFcmToken
  //
  // Previous code saved ONLY the FCM token to students/{uid}, without saving
  // the collegeId field. The server's Firestore query filters by BOTH:
  //   .where('collegeId', '==', collegeId)
  //   .where('favoriteBusIds', 'array-contains', busId)
  //
  // Fix: Also save collegeId when writing the FCM token.
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> _registerFcmToken(String uid, String collegeId) async {
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      
      final token = await messaging.getToken();
      if (token != null) {
        await _saveFcmToken(uid, token, collegeId);
      }

      // Listen for token refresh
      messaging.onTokenRefresh.listen((newToken) async {
        await _saveFcmToken(uid, newToken, collegeId);
      });

    } catch (e) {
      print("Error registering FCM token: $e");
    }
  }

  Future<void> _saveFcmToken(String uid, String token, String collegeId) async {
    final ref = FirebaseFirestore.instance.collection('students').doc(uid);
    try {
      await ref.update({
        'fcmToken': token,
        'collegeId': collegeId,   // ← CRITICAL: required for server query
      });
      print("FCM Token updated for $uid (college: $collegeId)");
    } catch (updateErr) {
      try {
        await ref.set({
          'fcmToken': token,
          'collegeId': collegeId,
        }, SetOptions(merge: true));
        print("FCM Token set (new doc) for $uid (college: $collegeId)");
      } catch (setErr) {
        print("Error saving FCM token: $updateErr | $setErr");
      }
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
  return AuthController(ref.watch(authRepositoryProvider), ref);
});
