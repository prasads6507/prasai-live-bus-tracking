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
      final userCredential = await _authRepository.signIn(email, password, collegeSlug);
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
      
      // 5. Register FCM Token (Step 5C)
      await _registerFcmToken(user.uid);
      
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
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
  Future<void> _registerFcmToken(String uid) async {
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      
      final token = await messaging.getToken();
      if (token != null) {
        await _saveFcmToken(uid, token);
      }

      // Listen for token refresh
      messaging.onTokenRefresh.listen((newToken) async {
        await _saveFcmToken(uid, newToken);
      });

    } catch (e) {
      print("Error registering FCM token: $e");
    }
  }

  Future<void> _saveFcmToken(String uid, String token) async {
    try {
      await FirebaseFirestore.instance
          .collection('students')
          .doc(uid)
          .set({'fcmToken': token}, SetOptions(merge: true));
      print("FCM Token saved for $uid");
    } catch (e) {
      print("Error saving FCM token: $e");
    }
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
  return AuthController(ref.watch(authRepositoryProvider), ref);
});
