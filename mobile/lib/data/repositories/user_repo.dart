import 'package:cloud_firestore/cloud_firestore.dart';
import '../datasources/auth_ds.dart';
import '../datasources/firestore_ds.dart';
import '../models/user_profile.dart';

class UserRepository {
  final AuthDataSource _authDataSource;
  final FirestoreDataSource _firestoreDataSource;

  UserRepository(this._authDataSource, this._firestoreDataSource);

  Future<UserProfile?> getCurrentUserProfile(String collegeId) async {
    final user = _authDataSource.currentUser;
    if (user == null) return null;

    final doc =
        await _firestoreDataSource.getUserInCollege(collegeId, user.uid);
    if (!doc.exists) return null;

    return UserProfile.fromFirestore(doc);
  }
}
