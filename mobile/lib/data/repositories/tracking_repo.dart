import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
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
    required String busNumber,
    required String direction,
    String? driverName,
    bool isMaintenance = false,
    String? originalBusId,
  }) async {
    final tripId = 'trip-$busId-${DateTime.now().millisecondsSinceEpoch}';

    // Fire and forget — notify server to send FCM to students IMMEDIATELY
    _apiDataSource.notifyTripStarted(
      collegeId: collegeId,
      busId: busId,
      tripId: tripId,
      busNumber: busNumber,
      driverId: driverId,
      routeId: routeId,
      isMaintenance: isMaintenance,
      originalBusId: originalBusId,
    ).catchError((e) {
      if (e is DioException) {
        debugPrint('[TripRepo] notifyTripStarted failed: ${e.message} | ${e.response?.statusCode} | ${e.response?.data}');
      } else {
        debugPrint('[TripRepo] notifyTripStarted failed: $e');
      }
      return null;
    });

    await _firestoreDataSource.startTrip(
      collegeId: collegeId,
      busId: busId,
      driverId: driverId,
      routeId: routeId,
      busNumber: busNumber,
      driverName: driverName,
      direction: direction,
      isMaintenance: isMaintenance,
      originalBusId: originalBusId,
      predefinedTripId: tripId,
    );

    return tripId;
  }


  Future<void> endTrip(String collegeId, String? tripId, String busId) async {
    await _firestoreDataSource.endTrip(tripId, busId);
    
    if (tripId != null && tripId.isNotEmpty) {
      // Fire and forget — notify students that trip ended
      _apiDataSource.notifyTripEnded(
        collegeId: collegeId,
        busId: busId,
        tripId: tripId,
      ).catchError((e) {
        if (e is DioException) {
          debugPrint('[TripRepo] notifyTripEnded failed: ${e.message} | ${e.response?.statusCode} | ${e.response?.data}');
        } else {
          debugPrint('[TripRepo] notifyTripEnded failed: $e');
        }
        return null;
      });
    }
  }
}
