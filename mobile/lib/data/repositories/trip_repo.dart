import '../datasources/firestore_ds.dart';
import '../models/trip.dart';

class TripRepository {
  final FirestoreDataSource _firestoreDataSource;

  TripRepository(this._firestoreDataSource);

  Stream<Trip?> getActiveTrip(String collegeId, String busId) {
    return _firestoreDataSource.getActiveTrip(collegeId, busId);
  }
}
