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

  Future<String> startTrip({
    required String collegeId,
    required String busId,
    required String driverId,
    required String routeId,
    String? busNumber,
    String? driverName,
    String direction = 'pickup',
  }) async {
    final tripId = await _firestoreDataSource.startTrip(
      collegeId: collegeId,
      busId: busId,
      driverId: driverId,
      routeId: routeId,
      busNumber: busNumber,
      driverName: driverName,
      direction: direction,
    );

    // Fire and forget notification
    _apiDataSource.notifyTripStarted(
      collegeId: collegeId,
      busId: busId,
      tripId: tripId,
      busNumber: busNumber,
    ).catchError((e) => print("Failed to send start trip notification: $e"));

    return tripId;
  }

  Future<void> endTrip(String collegeId, String? tripId, String busId) async {
    await _firestoreDataSource.endTrip(tripId, busId);
    
    if (tripId != null && tripId.isNotEmpty) {
      // Fire and forget notification
      _apiDataSource.notifyTripEnded(
        collegeId: collegeId,
        busId: busId,
        tripId: tripId,
      ).catchError((e) => print("Failed to send end trip notification: $e"));
    }
  }
}
