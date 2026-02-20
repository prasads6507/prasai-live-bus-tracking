import '../datasources/firestore_ds.dart';
import '../models/bus.dart';

class BusRepository {
  final FirestoreDataSource _firestoreDataSource;

  BusRepository(this._firestoreDataSource);

  Stream<List<Bus>> getBuses(String collegeId) {
    return _firestoreDataSource.getBuses(collegeId);
  }

  Stream<Bus> getBus(String collegeId, String busId) {
    return _firestoreDataSource.getBus(collegeId, busId);
  }
}
