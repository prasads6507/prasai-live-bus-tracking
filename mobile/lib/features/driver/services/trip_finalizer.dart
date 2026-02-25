import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'driver_location_service.dart';
import '../../../data/datasources/api_ds.dart';
import '../../../data/datasources/firestore_ds.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class TripFinalizer {
  static const String _kPendingFinalize = 'pending_finalize';
  static const String _kPendingTripId = 'pending_trip_id';
  static const String _kPendingBusId = 'pending_bus_id';
  static const String _kPendingCollegeId = 'pending_college_id';
  static const String _kPendingAttempts = 'pending_attempts';

  static ValueNotifier<bool> isFinalizing = ValueNotifier(false);
  static ValueNotifier<String?> error = ValueNotifier(null);

  /// Finalizes a trip in the background.
  /// 1. Stops tracking (local UI)
  /// 2. Stores pending job state
  /// 3. Uploads history
  /// 4. Calls endTrip API
  /// 5. Clears pending job
  static Future<void> finalizeTrip({
    required String collegeId,
    required String busId,
    required String tripId,
  }) async {
    if (isFinalizing.value) return;
    
    isFinalizing.value = true;
    error.value = null;

    final prefs = await SharedPreferences.getInstance();
    
    // 1. Store pending job state BEFORE starting
    await _storePendingJob(collegeId, busId, tripId);

    try {
      debugPrint("[TripFinalizer] Starting finalization for trip: $tripId");

      // 2. Upload buffered trip history
      // Note: uploadBufferedHistory now handles its own internal retry flags
      await DriverLocationService.uploadBufferedHistory(tripId);

      // 3. Call endTrip API (Idempotent)
      final prefsForToken = await SharedPreferences.getInstance();
      final token = prefsForToken.getString('auth_token');
      
      final dio = Dio();
      if (token != null) {
        dio.options.headers['Authorization'] = 'Bearer $token';
      }
      
      final apiDS = ApiDataSource(dio, FirebaseFirestore.instance);
      final firestoreDS = FirestoreDataSource(FirebaseFirestore.instance);

      try {
        await apiDS.endTrip(collegeId, tripId, busId);
        debugPrint("[TripFinalizer] API endTrip success");
      } catch (e) {
        debugPrint("[TripFinalizer] API endTrip failed: $e. Falling back to firestore endTrip.");
        await firestoreDS.endTrip(tripId, busId);
      }

      // 4. Cleanup local tracking keys
      await _clearPendingJob();
      debugPrint("[TripFinalizer] Finalization COMPLETED for trip: $tripId");
      
    } catch (e) {
      debugPrint("[TripFinalizer] Finalization FAILED: $e");
      error.value = e.toString();
      
      // Increment attempts
      int attempts = prefs.getInt(_kPendingAttempts) ?? 0;
      await prefs.setInt(_kPendingAttempts, attempts + 1);
    } finally {
      isFinalizing.value = false;
    }
  }

  static Future<void> _storePendingJob(String collegeId, String busId, String tripId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kPendingFinalize, true);
    await prefs.setString(_kPendingCollegeId, collegeId);
    await prefs.setString(_kPendingBusId, busId);
    await prefs.setString(_kPendingTripId, tripId);
    if (!prefs.containsKey(_kPendingAttempts)) {
      await prefs.setInt(_kPendingAttempts, 0);
    }
  }

  static Future<void> _clearPendingJob() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kPendingFinalize);
    await prefs.remove(_kPendingCollegeId);
    await prefs.remove(_kPendingBusId);
    await prefs.remove(_kPendingTripId);
    await prefs.remove(_kPendingAttempts);
  }

  static Future<Map<String, String?>?> getPendingJob() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_kPendingFinalize) != true) return null;

    return {
      'collegeId': prefs.getString(_kPendingCollegeId),
      'busId': prefs.getString(_kPendingBusId),
      'tripId': prefs.getString(_kPendingTripId),
    };
  }

  /// Automatically retries pending jobs on startup or home load.
  static Future<void> checkAndRetry() async {
    final job = await getPendingJob();
    if (job != null) {
      final collegeId = job['collegeId'];
      final busId = job['busId'];
      final tripId = job['tripId'];

      if (collegeId != null && busId != null && tripId != null) {
        debugPrint("[TripFinalizer] Retrying pending job for trip: $tripId");
        unawaited(finalizeTrip(
          collegeId: collegeId,
          busId: busId,
          tripId: tripId,
        ));
      }
    }
  }
}
