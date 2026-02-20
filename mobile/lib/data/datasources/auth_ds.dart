import 'package:firebase_auth/firebase_auth.dart';
import 'api_ds.dart';

class AuthDataSource {
  final FirebaseAuth _firebaseAuth;
  final ApiDataSource _apiDataSource;

  AuthDataSource(this._firebaseAuth, this._apiDataSource);

  Stream<User?> get authStateChanges => _firebaseAuth.authStateChanges();

  User? get currentUser => _firebaseAuth.currentUser;

  Future<UserCredential> signInWithApi(String email, String password, String orgSlug) async {
    // 1. Authenticate with Backend API
    final loginResponse = await _apiDataSource.login(email, password, orgSlug);
    
    final customToken = loginResponse['firebaseCustomToken'] as String?;
    if (customToken == null) {
      throw 'Server did not return a valid custom token.';
    }

    // 2. Sign in to Firebase with the Custom Token
    return _firebaseAuth.signInWithCustomToken(customToken);
  }

  Future<void> signOut() {
    return _firebaseAuth.signOut();
  }
}
