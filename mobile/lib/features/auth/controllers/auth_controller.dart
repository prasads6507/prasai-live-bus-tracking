import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../data/providers.dart';
import '../../../../data/repositories/auth_repo.dart';

// Current auth state
// (The authStateProvider and selectedCollegeIdProvider are now in providers.dart)

class AuthController extends StateNotifier<AsyncValue<void>> {
  final AuthRepository _authRepository;
  final Ref _ref;
  static const String _collegeIdKey = 'selected_college_id';

  AuthController(this._authRepository, this._ref) : super(const AsyncValue.data(null)) {
    _recoverSession();
  }

  Future<void> _recoverSession() async {
    final prefs = await SharedPreferences.getInstance();
    final collegeId = prefs.getString(_collegeIdKey);
    final collegeSlug = prefs.getString('college_slug');
    final collegeName = prefs.getString('college_name');

    if (collegeId != null && collegeSlug != null && collegeName != null) {
      _ref.read(selectedCollegeIdProvider.notifier).state = collegeId;
      _ref.read(selectedCollegeProvider.notifier).state = {
        'collegeId': collegeId,
        'slug': collegeSlug,
        'collegeName': collegeName,
      };
    }
  }

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
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
  return AuthController(ref.watch(authRepositoryProvider), ref);
});
