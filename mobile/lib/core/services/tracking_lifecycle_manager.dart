import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import '../../features/driver/services/background_tracking_service.dart';

class TrackingLifecycleManager {
  static Stream<bool> isTripActive(String collegeId, String busId) {
    return FirebaseFirestore.instance
        .collection('buses')
        .doc(busId)
        .snapshots()
        .map((snapshot) {
          if (!snapshot.exists) return false;
          final data = snapshot.data()!;
          final activeTripId = data['activeTripId'] as String?;
          final status = data['status'] as String?;
          // Trip is active if we have an activeTripId and status is ON_ROUTE
          return activeTripId != null && activeTripId.isNotEmpty && status == 'ON_ROUTE';
        });
  }

  static Future<void> stopTrackingAndClearContext() async {
    try {
      // 1. Stop background service
      await BackgroundTrackingService.stop();

      // 2. Clear SharedPreferences keys
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('track_college_id');
      await prefs.remove('track_bus_id');
      await prefs.remove('track_trip_id');
      await prefs.remove('next_stop_id');
      await prefs.remove('next_stop_lat');
      await prefs.remove('next_stop_lng');
      await prefs.remove('next_stop_radius');
      await prefs.remove('trip_history_buffer');
      
      print("[TrackingLifecycleManager] Tracking stopped and context cleared.");
    } catch (e) {
      print("[TrackingLifecycleManager] Error stopping tracking: $e");
    }
  }
}
