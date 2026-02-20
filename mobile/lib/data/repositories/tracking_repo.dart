import '../datasources/api_ds.dart';
import '../datasources/firestore_ds.dart';
import '../models/location_point.dart';

class TrackingRepository {
  final ApiDataSource _apiDataSource;
  final FirestoreDataSource _firestoreDataSource;

  TrackingRepository(this._apiDataSource, this._firestoreDataSource);

  Future<void> updateDriverLocation(
      String collegeId, String busId, List<LocationPoint> points) {
    // We use firestore for real-time tracking to ensure global connectivity
    return _firestoreDataSource.updateDriverLocation(collegeId, busId, points);
  }

  Future<void> updateBusLiveBuffer(
      String collegeId, String busId, List<LocationPoint> points) {
    return _firestoreDataSource.updateBusLiveBuffer(collegeId, busId, points);
  }

  Future<void> startTrip(
      String collegeId, String busId, String driverId, String routeId) {
    return _firestoreDataSource.startTrip(
      collegeId: collegeId,
      busId: busId,
      driverId: driverId,
      routeId: routeId,
    );
  }

  Future<void> endTrip(String collegeId, String tripId, String busId) {
    return _firestoreDataSource.endTrip(tripId, busId);
  }
}
