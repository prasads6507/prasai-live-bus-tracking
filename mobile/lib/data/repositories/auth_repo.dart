import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../datasources/auth_ds.dart';
import '../datasources/firestore_ds.dart';

class AuthRepository {
  final AuthDataSource _authDataSource;
  final FirestoreDataSource _firestoreDataSource;

  AuthRepository(this._authDataSource, this._firestoreDataSource);

  Stream<User?> get authStateChanges => _authDataSource.authStateChanges;

  User? get currentUser => _authDataSource.currentUser;

  Future<String?> findCollegeIdBySlug(String slug) {
    return _firestoreDataSource.findCollegeIdBySlug(slug);
  }

  Future<DocumentSnapshot> getUserInCollege(String collegeId, String uid) {
    return _firestoreDataSource.getUserInCollege(collegeId, uid);
  }

  Future<UserCredential> signIn(String email, String password, String orgSlug) {
    return _authDataSource.signInWithApi(email, password, orgSlug);
  }

  Future<void> signOut() {
    return _authDataSource.signOut();
  }
}
