import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import '../../../../firebase_options.dart';
import 'trip_finalizer.dart';

// ─── ADAPTIVE TRACKING CONSTANTS ───
const double _ARRIVING_DISTANCE_M = 804.0;   // 0.5 mile
const double _ARRIVED_RADIUS_M = 100.0;       // Mark stop as reached
const int _FAR_UPDATE_SEC = 20;               // Write interval in FAR mode
const int _NEAR_UPDATE_SEC = 5;               // Write interval in NEAR_STOP mode

class BackgroundTrackingService {
  static bool _isRunning = false;  // Static guard: prevents double-start at service level

  static Future<void> initialize() async {
    try {
      final service = FlutterBackgroundService();

      await service.configure(
        androidConfiguration: AndroidConfiguration(
          onStart: onStart,
          autoStart: false,
          isForegroundMode: true,
          notificationChannelId: 'bus_tracking',
          initialNotificationTitle: 'Tracking Active',
          initialNotificationContent: 'Ready to track trip',
        ),
        iosConfiguration: IosConfiguration(
          autoStart: false,
          onForeground: onStart,
          onBackground: onIosBackground,
        ),
      );
    } catch (e) {
      debugPrint("[BackgroundTrackingService] initialize() failed (non-fatal): $e");
    }
  }

  static Future<void> start() async {
    if (_isRunning) {
      debugPrint("[BackgroundTrackingService] start() SKIPPED - already running");
      return;
    }
    _isRunning = true;
    try {
      final service = FlutterBackgroundService();
      await service.startService();
    } catch (e) {
      _isRunning = false;
      debugPrint("[BackgroundTrackingService] start() FAILED: $e");
      rethrow;
    }
  }

  static Future<void> stop() async {
    _isRunning = false;
    try {
      final service = FlutterBackgroundService();
      service.invoke("stopService");
    } catch (e) {
      debugPrint("[BackgroundTrackingService] stop() error (non-fatal): $e");
    }
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    WidgetsFlutterBinding.ensureInitialized();
    return true;
  }

  @pragma('vm:entry-point')
  static void onStart(ServiceInstance service) async {
    // Top-level try/catch: ANY crash in background isolate kills the app process.
    // This ensures we stop gracefully instead of crashing.
    try {
      DartPluginRegistrant.ensureInitialized();
      
      // 1. Initialize Firebase and SharedPreferences
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      }
      final prefs = await SharedPreferences.getInstance();
      
      // 2. Setup service commands
      StreamSubscription<Position>? posSubscription;
      service.on('stopService').listen((event) {
        posSubscription?.cancel();
        service.stopSelf();
      });

      // 3. Load tracking context
      final collegeId = prefs.getString('track_college_id');
      final busId = prefs.getString('track_bus_id');
      final tripId = prefs.getString('track_trip_id');

      if (collegeId == null || busId == null || tripId == null) {
        debugPrint("[Background] Context missing, stopping service.");
        service.stopSelf();
        return;
      }

      debugPrint("[Background] Tracking STARTED for Bus $busId, Trip $tripId");

      // 4. Update Notification (wrapped in try/catch for channel creation issues)
      try {
        if (service is AndroidServiceInstance) {
          service.setForegroundNotificationInfo(
            title: "Tracking Active",
            content: "Bus $busId is on route",
          );
        }
      } catch (e) {
        debugPrint("[Background] Notification update failed (non-fatal): $e");
      }

      // 5. Adaptive State
      int lastWriteMs = 0;
      String currentMode = "FAR";
      String currentStatus = "ON_ROUTE";

      // 6. Start Location Stream (wrapped in try/catch for permission edge cases)
      late final Stream<Position> positionStream;
      try {
        positionStream = Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 10,
          ),
        );
      } catch (e) {
        debugPrint("[Background] Failed to start position stream: $e");
        service.stopSelf();
        return;
      }

      posSubscription = positionStream.listen((Position position) async {
        // Wrap entire callback in try/catch — crash here kills app process
        try {
          final now = DateTime.now();
          
          // A. Buffer GPS point locally
          await _bufferPoint(prefs, position);

          // B. Load cached next stop
          final nextStopLat = prefs.getDouble('next_stop_lat');
          final nextStopLng = prefs.getDouble('next_stop_lng');
          final nextStopId = prefs.getString('next_stop_id') ?? '';
          final nextStopRadius = prefs.getDouble('next_stop_radius') ?? 100.0;

          double distToNextStop = double.infinity;
          if (nextStopLat != null && nextStopLng != null) {
            distToNextStop = Geolocator.distanceBetween(
              position.latitude, position.longitude, nextStopLat, nextStopLng
            );
          }

          // C. Compute Adaptive mode
          final newState = _computeAdaptiveState(distToNextStop, currentStatus, nextStopRadius);
          final newMode = newState['mode']!;
          final newStatus = newState['status']!;

          // D. Determine if we should write to Firestore
          final elapsedMs = now.millisecondsSinceEpoch - lastWriteMs;
          final intervalSec = newMode == 'NEAR_STOP' ? _NEAR_UPDATE_SEC : _FAR_UPDATE_SEC;
          
          final statusChanged = newStatus != currentStatus;
          final modeChanged = newMode != currentMode;
          final intervalElapsed = elapsedMs >= (intervalSec * 1000);

          if (statusChanged || modeChanged || intervalElapsed) {
            await _writeToFirestore(prefs, busId!, tripId!, position, newMode, newStatus, nextStopId);
            lastWriteMs = now.millisecondsSinceEpoch;
            currentMode = newMode;
            currentStatus = newStatus;
            
            // E. Geofence / Stop Arrival logic
            if (distToNextStop <= nextStopRadius && statusChanged && newStatus == 'ARRIVED') {
               await _handleArrival(prefs, collegeId!, busId!, tripId!, nextStopId, position);
            }
          }
          
          // F. Send to Main Isolate for UI feedback (if running)
          service.invoke('update', {
            "lat": position.latitude,
            "lng": position.longitude,
            "speed": position.speed,
            "heading": position.heading,
            "status": newStatus,
            "mode": newMode,
          });
        } catch (e) {
          debugPrint("[Background] Position callback error (non-fatal): $e");
        }
      }, onError: (e) {
        debugPrint("[Background] Stream error: $e");
      });
    } catch (e) {
      debugPrint("[Background] CRITICAL onStart error: $e");
      service.stopSelf();
    }
  }

  static Future<void> _bufferPoint(SharedPreferences prefs, Position p) async {
    final newPoint = {
      'lat': p.latitude,
      'lng': p.longitude,
      'speed': (p.speed * 2.23694).round(),
      'heading': p.heading,
      'timestamp': DateTime.now().toIso8601String(),
    };

    final bufferStr = prefs.getString('trip_history_buffer') ?? '[]';
    List<dynamic> buffer = jsonDecode(bufferStr);
    buffer.add(newPoint);
    if (buffer.length > 5000) buffer.removeAt(0);
    await prefs.setString('trip_history_buffer', jsonEncode(buffer));
  }

  static Future<void> _writeToFirestore(
    SharedPreferences prefs,
    String busId,
    String tripId,
    Position p,
    String mode,
    String status,
    String nextStopId,
  ) async {
    try {
      final speedMph = (p.speed * 2.23694).round();
      final db = FirebaseFirestore.instance;
      
      await db.collection('buses').doc(busId).update({
        'lastLocationUpdate': FieldValue.serverTimestamp(),
        'location': {
          'latitude': p.latitude,
          'longitude': p.longitude,
          'heading': p.heading,
        },
        'currentLocation': {
          'lat': p.latitude,
          'lng': p.longitude,
          'latitude': p.latitude,
          'longitude': p.longitude,
          'heading': p.heading,
        },
        'speedMph': speedMph,
        'currentStatus': status,
        'trackingMode': mode,
        'nextStopId': nextStopId,
      });
      debugPrint("[Background] Firestore WRITE: status=$status, speed=${speedMph}mph");
    } catch (e) {
      debugPrint("[Background] Firestore WRITE FAILED: $e");
    }
  }

  static Future<void> _handleArrival(
    SharedPreferences prefs,
    String collegeId,
    String busId,
    String tripId,
    String stopId,
    Position p,
  ) async {
    try {
      final db = FirebaseFirestore.instance;
      
      // Update Trip Progress
      final tripRef = db.collection('trips').doc(tripId);
      final tripDoc = await tripRef.get();
      if (!tripDoc.exists) return;

      final data = tripDoc.data()!;
      final progress = data['stopProgress'] as Map<String, dynamic>? ?? {};
      final arrivedIds = List<String>.from(progress['arrivedStopIds'] ?? []);
      final arrivals = Map<String, dynamic>.from(progress['arrivals'] ?? {});
      final stops = (data['stopsSnapshot'] as List<dynamic>?) ?? [];
      final currentIndex = (progress['currentIndex'] as num?)?.toInt() ?? 0;

      if (!arrivedIds.contains(stopId)) {
        arrivedIds.add(stopId);
        arrivals[stopId] = DateTime.now().toIso8601String();
        
        final newIndex = currentIndex + 1;
        final isFinalStop = newIndex >= stops.length;

        await tripRef.update({
          'stopProgress.currentIndex': newIndex,
          'stopProgress.arrivedStopIds': arrivedIds,
          'stopProgress.arrivals': arrivals,
        });

        // Trigger Arrival Event for Notifications
        await db.collection('stopArrivals').add({
          'tripId': tripId,
          'busId': busId,
          'collegeId': collegeId,
          'stopId': stopId,
          'arrivedAt': DateTime.now().toIso8601String(),
          'processed': false,
        });

        // Cache NEXT stop
        if (!isFinalStop) {
          final nextStop = stops[newIndex] as Map<String, dynamic>;
          await prefs.setDouble('next_stop_lat', (nextStop['lat'] as num).toDouble());
          await prefs.setDouble('next_stop_lng', (nextStop['lng'] as num).toDouble());
          await prefs.setDouble('next_stop_radius', (nextStop['radiusM'] as num?)?.toDouble() ?? 100.0);
          await prefs.setString('next_stop_id', nextStop['stopId'] as String);
        } else {
          // AUTO-END
          debugPrint("[Background] AUTO-ENDING TRIP at final stop");
          await tripRef.update({'status': 'COMPLETED', 'isActive': false});
          // We can't easily run the full TripFinalizer from here without more work,
          // but we can set the pending flag.
          await prefs.setBool('pending_finalize', true);
          await prefs.setString('pending_trip_id', tripId);
          await prefs.setString('pending_bus_id', busId);
          await prefs.setString('pending_college_id', collegeId);
          
          FlutterBackgroundService().invoke("stopService");
        }
      }
    } catch (e) {
      debugPrint("[Background] HandleArrival error: $e");
    }
  }

  static Map<String, String> _computeAdaptiveState(
    double distToNextStopM,
    String currentStatus,
    double radiusM,
  ) {
    if (distToNextStopM <= radiusM) {
      return {'mode': 'NEAR_STOP', 'status': 'ARRIVED'};
    } else if (distToNextStopM <= _ARRIVING_DISTANCE_M) {
      return {'mode': 'NEAR_STOP', 'status': 'ARRIVING'};
    } else {
      return {'mode': 'FAR', 'status': 'ON_ROUTE'};
    }
  }
}
