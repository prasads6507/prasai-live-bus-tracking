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

      // 5. Adaptive State & Speed Estimation
      int lastWriteMs = 0;
      String currentMode = "FAR";
      String currentStatus = "ON_ROUTE";
      Position? lastPosition;
      double smoothedSpeedMph = 0.0;
      const double emaAlpha = 0.25; // Smoothing factor

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
          
          // A. Compute Robust Speed (mph)
          double rawSpeedMph = 0.0;
          if (position.speed > 0.5) {
            rawSpeedMph = position.speed * 2.23694;
          } else if (lastPosition != null) {
            // Dead-reckoning fallback: dist / time
            final distM = Geolocator.distanceBetween(
              lastPosition!.latitude, lastPosition!.longitude,
              position.latitude, position.longitude
            );
            final timeSec = position.timestamp.difference(lastPosition!.timestamp).inSeconds;
            if (timeSec > 0 && distM > 2) {
              rawSpeedMph = (distM / timeSec) * 2.23694;
            }
          }
          
          // Clamp noise and smooth
          if (rawSpeedMph < 1.0) rawSpeedMph = 0.0;
          if (rawSpeedMph > 85.0) rawSpeedMph = smoothedSpeedMph; // Clamp jumps
          
          smoothedSpeedMph = (emaAlpha * rawSpeedMph) + ((1 - emaAlpha) * smoothedSpeedMph);
          final finalSpeedMph = smoothedSpeedMph.round();

          // B. Buffer GPS point locally
          await _bufferPoint(prefs, position, finalSpeedMph);

          // C. Load cached next stop
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

          // D. Compute Adaptive mode
          final newState = _computeAdaptiveState(distToNextStop, currentStatus, nextStopRadius);
          final newMode = newState['mode']!;
          final newStatus = newState['status']!;

          // E. Determine if we should write to Firestore
          final elapsedMs = now.millisecondsSinceEpoch - lastWriteMs;
          final intervalSec = newMode == 'NEAR_STOP' ? _NEAR_UPDATE_SEC : _FAR_UPDATE_SEC;
          
          final statusChanged = newStatus != currentStatus;
          final modeChanged = newMode != currentMode;
          final intervalElapsed = elapsedMs >= (intervalSec * 1000);

          if (statusChanged || modeChanged || intervalElapsed) {
            await _writeToFirestore(prefs, busId!, tripId!, position, newMode, newStatus, nextStopId, finalSpeedMph);
            lastWriteMs = now.millisecondsSinceEpoch;
            currentMode = newMode;
            currentStatus = newStatus;
            
            // F. Geofence / Stop Arrival logic
            if (distToNextStop <= nextStopRadius && statusChanged && newStatus == 'ARRIVED') {
               await _handleArrival(prefs, collegeId!, busId!, tripId!, nextStopId, position);
            }
            // G. Skip logic: If we are much closer to the *subsequent* stop than the current next stop
            else if (distToNextStop > nextStopRadius && distToNextStop < 500) {
              // Check if we passed it. We look at the stop list in prefs (if we had it)
              // For now, we'll implement a robust "closer to next-next" if we can fetch it.
              // A simpler robust skip: if distToNextStop starts increasing after being < 400m
              // and we are now > 500m away, it's likely skipped.
              // But the most reliable is "Closer to stop[currentIndex + 1]".
              await _checkForSkip(prefs, collegeId!, busId!, tripId!, nextStopId, position, distToNextStop);
            }
          }
          
          lastPosition = position;
          
          // G. Send to Main Isolate for UI feedback (if running)
          service.invoke('update', {
            "lat": position.latitude,
            "lng": position.longitude,
            "speed": smoothedSpeedMph / 2.23694, // Send m/s back to UI for consistency
            "speedMph": finalSpeedMph,
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

  static Future<void> _bufferPoint(SharedPreferences prefs, Position p, int speedMph) async {
    final newPoint = {
      'lat': p.latitude,
      'lng': p.longitude,
      'speed': speedMph,
      'speedMph': speedMph,
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
    int speedMph,
  ) async {
    try {
      final db = FirebaseFirestore.instance;
      
      await db.collection('buses').doc(busId).update({
        'lastLocationUpdate': FieldValue.serverTimestamp(),
        'location': {
          'latitude': p.latitude,
          'longitude': p.longitude,
          'heading': p.heading,
          'speed': speedMph,
          'speedMph': speedMph,
          'timestamp': FieldValue.serverTimestamp(),
        },
        'currentLocation': {
          'lat': p.latitude,
          'lng': p.longitude,
          'latitude': p.latitude,
          'longitude': p.longitude,
          'heading': p.heading,
          'speedMph': speedMph,
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

  static Future<void> _checkForSkip(
    SharedPreferences prefs,
    String collegeId,
    String busId,
    String tripId,
    String currentStopId,
    Position p,
    double distToCurrentM,
  ) async {
    try {
      final db = FirebaseFirestore.instance;
      final tripRef = db.collection('trips').doc(tripId);
      final tripDoc = await tripRef.get();
      if (!tripDoc.exists) return;

      final data = tripDoc.data()!;
      final progress = data['stopProgress'] as Map<String, dynamic>? ?? {};
      final currentIndex = (progress['currentIndex'] as num?)?.toInt() ?? 0;
      final stops = (data['stopsSnapshot'] as List<dynamic>?) ?? [];

      if (currentIndex + 1 < stops.length) {
        final followingStop = stops[currentIndex + 1] as Map<String, dynamic>;
        final distToFollowingM = Geolocator.distanceBetween(
          p.latitude, p.longitude,
          (followingStop['lat'] as num).toDouble(),
          (followingStop['lng'] as num).toDouble()
        );

        // If we are significantly closer to the following stop than the current one, we skipped it
        if (distToFollowingM < distToCurrentM && distToCurrentM > 300) {
          debugPrint("[Background] SKIP DETECTED: $currentStopId. Heading to ${followingStop['stopId']}");
          
          final skippedIds = List<String>.from(progress['skippedStopIds'] ?? []);
          if (!skippedIds.contains(currentStopId)) {
            skippedIds.add(currentStopId);
            
            final newIndex = currentIndex + 1;
            await tripRef.update({
              'stopProgress.currentIndex': newIndex,
              'stopProgress.skippedStopIds': skippedIds,
            });

            // Trigger Skip Event for Notifications
            await db.collection('stopArrivals').add({
              'tripId': tripId,
              'busId': busId,
              'collegeId': collegeId,
              'stopId': currentStopId,
              'stopName': stops[currentIndex]['name'] ?? 'Stop',
              'type': 'SKIPPED',
              'timestamp': DateTime.now().toIso8601String(),
              'processed': false,
            });

            // Cache NEXT-NEXT stop
            final nextStop = stops[newIndex] as Map<String, dynamic>;
            await prefs.setDouble('next_stop_lat', (nextStop['lat'] as num).toDouble());
            await prefs.setDouble('next_stop_lng', (nextStop['lng'] as num).toDouble());
            await prefs.setDouble('next_stop_radius', (nextStop['radiusM'] as num?)?.toDouble() ?? 100.0);
            await prefs.setString('next_stop_id', nextStop['stopId'] as String);
          }
        }
      }
    } catch (e) {
      debugPrint("[Background] CheckForSkip error: $e");
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
          'stopProgress.completedStopIds': FieldValue.arrayUnion([stopId]), 
        });

        // Trigger Arrival Event for Notifications
        await db.collection('stopArrivals').add({
          'tripId': tripId,
          'busId': busId,
          'collegeId': collegeId,
          'stopId': stopId,
          'stopName': stops[currentIndex]['name'] ?? 'Stop',
          'type': 'ARRIVED',
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
