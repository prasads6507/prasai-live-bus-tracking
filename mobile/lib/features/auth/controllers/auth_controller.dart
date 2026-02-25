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
      
      // 5. Register FCM Token — pass collegeId and userDoc so it can determine role
      await _registerFcmToken(user.uid, collegeId, userDoc);
      
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

  Future<void> registerFcmTokenForSession(String uid, String collegeId) async {
    try {
      final userDoc = await _authRepository.getUserInCollege(collegeId, uid);
      if (userDoc.exists) {
        await _registerFcmToken(uid, collegeId, userDoc);
      }
    } catch (e) {
      print("Error during session token registration: $e");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUG FIX: _registerFcmToken / _saveFcmToken
  //
  // Previous code saved ONLY the FCM token to students/{uid}, which created
  // fake student records for drivers.
  // Fix: Save to 'users' if role is DRIVER/ADMIN, else 'students'.
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> _registerFcmToken(String uid, String collegeId, DocumentSnapshot userDoc) async {
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      
      final data = userDoc.data() as Map<String, dynamic>?;
      final role = (data?['role'] as String?)?.toUpperCase() ?? 'STUDENT';
      // Drivers/Admins are in 'users', Students are in 'students'
      final collection = (role == 'DRIVER' || role == 'ADMIN' || role == 'COLLEGE_ADMIN') 
          ? 'users' : 'students';

      final token = await messaging.getToken();
      if (token != null) {
        await _saveFcmToken(uid, token, collegeId, collection);
      }

      // Listen for token refresh
      messaging.onTokenRefresh.listen((newToken) async {
        await _saveFcmToken(uid, newToken, collegeId, collection);
      });

    } catch (e) {
      print("Error registering FCM token: $e");
    }
  }

  Future<void> _saveFcmToken(String uid, String token, String collegeId, String collection) async {
    final ref = FirebaseFirestore.instance.collection(collection).doc(uid);
    try {
      // Use update to avoid overwriting existing fields like role/name
      await ref.update({
        'fcmToken': token,
        'collegeId': collegeId,
      });
      print("FCM Token updated for $uid in $collection");
    } catch (updateErr) {
      // If doc doesn't exist, we must use set with merge
      try {
        await ref.set({
          'fcmToken': token,
          'collegeId': collegeId,
        }, SetOptions(merge: true));
        print("FCM Token set (merge) for $uid in $collection");
      } catch (setErr) {
        print("Error saving FCM token to $collection: $updateErr | $setErr");
      }
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
  return AuthController(ref.watch(authRepositoryProvider), ref);
});
