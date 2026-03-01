import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:ui';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../../firebase_options.dart';
import '../../../../core/config/env.dart';
import 'trip_finalizer.dart';

// ─── ADAPTIVE TRACKING CONSTANTS ───
const double _ARRIVING_DISTANCE_M = 804.0;   // 0.5 mile
const double _ARRIVED_RADIUS_M = 100.0;       // Mark stop as reached
const int _FAR_UPDATE_SEC = 20;               // Write interval in FAR mode
const int _NEAR_UPDATE_SEC = 5;               // Write interval in NEAR_STOP mode

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  // 1. Core Binding & Notification (CRITICAL: Must happen FAST on Android 14+ to avoid ForegroundServiceStartNotAllowedException)
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.setForegroundNotificationInfo(
      title: "Tracking Active",
      content: "Ready to track trip",
    );
  }

  // Top-level try/catch: ANY crash in background isolate kills the app process.
  try {
    // 2. Initialize Firebase and SharedPreferences
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    }
    final prefs = await SharedPreferences.getInstance();
    
    // 2. Setup service commands
    StreamSubscription<Position>? posSubscription;
    Map<String, dynamic>? lastUpdateData;

    service.on('request_update').listen((event) async {
      debugPrint("[Background] request_update received. Replaying state...");
      if (lastUpdateData != null) {
        service.invoke('update', lastUpdateData);
      }
    });

    service.on('stopService').listen((event) async {
      debugPrint("[Background] stopService received. Cleaning up...");
      await posSubscription?.cancel();
      // Clear static guard in case we are in the same process
      BackgroundTrackingService._isRunning = false; 
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

    // 4. Update Notification with specific bus ID if possible
    if (service is AndroidServiceInstance && busId != null) {
      service.setForegroundNotificationInfo(
        title: "Tracking Active",
        content: "Bus $busId is on route",
      );
    }

    // 5. Adaptive State & Speed Estimation
    int lastWriteMs = 0;
    String currentMode = "FAR";
    String currentStatus = "ON_ROUTE";
    Position? lastPosition;
    double smoothedSpeedMph = 0.0;
    const double emaAlpha = 0.25; // Smoothing factor
    final Set<String> arrivingNotifiedIds = {};

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
        await BackgroundTrackingService._bufferPoint(prefs, position, finalSpeedMph);

        // C. Load cached next stop
        final nextStopLat = prefs.getDouble('next_stop_lat');
        final nextStopLng = prefs.getDouble('next_stop_lng');
        final nextStopId = prefs.getString('next_stop_id') ?? '';
        final nextStopRadius = prefs.getDouble('next_stop_radius') ?? 100.0;
        final nextStopName = prefs.getString('next_stop_name') ?? 'Stop';

        double distToNextStop = double.infinity;
        if (nextStopLat != null && nextStopLng != null) {
          distToNextStop = Geolocator.distanceBetween(
            position.latitude, position.longitude, nextStopLat, nextStopLng
          );
        }

        // D. Compute Adaptive mode (Latch logic)
        final hasArrivedCurrent = prefs.getBool('has_arrived_current') ?? false;
        
        final newState = BackgroundTrackingService._computeAdaptiveState(distToNextStop, currentStatus, nextStopRadius, hasArrivedCurrent);
        final newMode = newState['mode']!;
        final newStatus = newState['status']!;

        // E. Determine if we should write to Firestore
        final elapsedMs = now.millisecondsSinceEpoch - lastWriteMs;
        final intervalSec = newMode == 'NEAR_STOP' ? _NEAR_UPDATE_SEC : _FAR_UPDATE_SEC;
        
        final statusChanged = newStatus != currentStatus;
        final modeChanged = newMode != currentMode;
        final intervalElapsed = elapsedMs >= (intervalSec * 1000);

        if (statusChanged || modeChanged || intervalElapsed) {
          // Fire and forget Firestore update to keep the location loop spinning
          BackgroundTrackingService._writeToFirestore(prefs, busId!, tripId!, position, newMode, newStatus, nextStopId, finalSpeedMph);
          lastWriteMs = now.millisecondsSinceEpoch;
          currentMode = newMode;
          currentStatus = newStatus;
        }

        // F. Geofence / Stop Arrival logic (Latching Entry) - Checked on EVERY point for immediate notifications
        if (distToNextStop <= nextStopRadius && !hasArrivedCurrent) {
            await prefs.setBool('has_arrived_current', true);
            // Non-blocking arrival entry
            BackgroundTrackingService._handleArrivalEntry(prefs, collegeId!, busId!, tripId!, nextStopId, position);
        }
        // H. Geofence / Exit logic (Latching Exit)
        else if (distToNextStop > (nextStopRadius + 30) && hasArrivedCurrent) {
            await prefs.setBool('has_arrived_current', false);
            // Non-blocking stop completion
            BackgroundTrackingService._handleStopCompletion(prefs, collegeId!, busId!, tripId!, nextStopId);
        }
        // G. Skip logic: Using more reliable 500m proximity to next stop
        else if (!hasArrivedCurrent && distToNextStop > nextStopRadius) {
          // Non-blocking skip check
          BackgroundTrackingService._checkForSkip(prefs, collegeId!, busId!, tripId!, nextStopId, position, distToNextStop);
        }

        // G2. Arriving Soon Notification (Trigger once per stop at 0.5 mile)
        if (newStatus == 'ARRIVING' && !arrivingNotifiedIds.contains(nextStopId)) {
            arrivingNotifiedIds.add(nextStopId);
            BackgroundTrackingService._notifyServer(
              tripId!, busId!, collegeId!, nextStopId, "ARRIVING",
              stopName: nextStopName,
              prefs: prefs,
            );
        }
        
        lastPosition = position;
        
        // G. Send to Main Isolate for UI feedback (if running)
        debugPrint("[Background] Invoking update event: lat=${position.latitude}, lng=${position.longitude}, status=$newStatus");
        
        lastUpdateData = {
          "lat": position.latitude,
          "lng": position.longitude,
          "speed": smoothedSpeedMph / 2.23694, // Send m/s back to UI for consistency
          "speedMph": finalSpeedMph,
          "heading": position.heading,
          "status": newStatus,
          "mode": newMode,
          "nextStopId": nextStopId,      // CRITICAL: Ensure ID is sent for skip logic
          "nextStopName": nextStopName, // Added for UI (Phase 1.2)
        };
        
        service.invoke('update', lastUpdateData);
      } catch (e) {
        debugPrint("[Background] Position callback error (non-fatal): $e");
      }
    }, onError: (e) {
      debugPrint("[Background] Stream error: $e");
    });

    // 7. Event Listeners for UI commands
    service.on('skip_stop').listen((event) {
      BackgroundTrackingService._handleManualSkip(service, event);
    });
  } catch (e) {
    debugPrint("[Background] CRITICAL onStart error: $e");
    service.stopSelf();
  }
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
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
          foregroundServiceTypes: [AndroidForegroundType.location],
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
    _isRunning = false; // Guard reset
    try {
      final service = FlutterBackgroundService();
      service.invoke("stopService");
    } catch (e) {
      debugPrint("[BackgroundTrackingService] stop() error: $e");
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
        'status': 'ON_ROUTE',       // CRITICAL: Admin panel filters by this top-level field
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
        'speed': speedMph,          // LEGACY
        'speedMph': speedMph,       // CANONICAL
        'currentSpeed': speedMph,   // ALIAS
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

        // Robust Skip: DISABLED AUTO-SKIP (User Request Phase 1.2)
        if (distToFollowingM < distToCurrentM && distToCurrentM > 500) {
           debugPrint("[Background] AUTO-SKIP DETECTED for $currentStopId but MANUAL SKIP REQUIRED.");
           // We do nothing here now — waiting for manual driver trigger via UI
        }
      }
    } catch (e) {
      debugPrint("[Background] CheckForSkip error: $e");
    }
  }

  // MANUAL SKIP IMPLEMENTATION (Phase 1.2)
  static Future<void> _handleManualSkip(ServiceInstance service, Map<String, dynamic>? params) async {
    if (params == null) return;
    
    final stopId = params['stopId'] as String?;
    if (stopId == null) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final collegeId = prefs.getString('track_college_id');
      final busId = prefs.getString('track_bus_id');
      final tripId = prefs.getString('track_trip_id');

      if (collegeId == null || busId == null || tripId == null) {
        debugPrint("[Background] Skip failed: missing context");
        return;
      }

      final db = FirebaseFirestore.instance;
      final tripRef = db.collection('trips').doc(tripId);
      final tripDoc = await tripRef.get();
      if (!tripDoc.exists) return;

      final data = tripDoc.data()!;
      final progress = data['stopProgress'] as Map<String, dynamic>? ?? {};
      final currentIndex = (progress['currentIndex'] as num?)?.toInt() ?? 0;
      final stops = (data['stopsSnapshot'] as List<dynamic>?) ?? [];

      // Verify the stopId matches the CURRENT stop in progress
      if (stops[currentIndex]['stopId'] != stopId) {
        debugPrint("[Background] Skip mismatch: targeted $stopId, currently at ${stops[currentIndex]['stopId']}");
        return;
      }

      if (currentIndex + 1 < stops.length) {
        final batch = db.batch();
        final skippedIds = List<String>.from(progress['skippedStopIds'] ?? []);
        
        if (!skippedIds.contains(stopId)) {
          skippedIds.add(stopId);
          final newIndex = currentIndex + 1;
          final nextStop = stops[newIndex] as Map<String, dynamic>;

          // 1. Update Trip Progress
          batch.update(tripRef, {
            'stopProgress.currentIndex': newIndex,
            'stopProgress.skippedStopIds': skippedIds,
          });

          // 2. Trigger Skip Event for Notifications
          final notifRef = db.collection('stopArrivals').doc();
          batch.set(notifRef, {
            'tripId': tripId,
            'busId': busId,
            'collegeId': collegeId,
            'stopId': stopId,
            'stopName': stops[currentIndex]['name'] ?? 'Stop',
            'type': 'SKIPPED',
            'timestamp': DateTime.now().toIso8601String(),
            'processed': true,
          });

          // 3. Update Bus Status
          batch.update(db.collection('buses').doc(busId), {
            'nextStopId': nextStop['stopId'],
            'currentStatus': 'ON_ROUTE',
          });

          // 4. Trigger Server FCM
          final stopData = stops[currentIndex] as Map<String, dynamic>;
          final targetStudentIds = (stopData['studentIds'] as List<dynamic>?)?.cast<String>();

          _notifyServer(tripId, busId, collegeId, stopId, "SKIPPED", 
            stopName: stops[currentIndex]['name'],
            arrivalDocId: notifRef.id,
            targetStudentIds: targetStudentIds,
            prefs: prefs
          );

          await batch.commit();

          // 5. Update Local Cache for Isolate
          await prefs.setDouble('next_stop_lat', (nextStop['lat'] as num).toDouble());
          await prefs.setDouble('next_stop_lng', (nextStop['lng'] as num).toDouble());
          await prefs.setDouble('next_stop_radius', (nextStop['radiusM'] as num?)?.toDouble() ?? 100.0);
          await prefs.setString('next_stop_id', nextStop['stopId'] as String);
          await prefs.setString('next_stop_name', (nextStop['name'] as String?) ?? 'Stop');
          await prefs.setBool('has_arrived_current', false);

          debugPrint("[Background] MANUAL SKIP SUCCESS: $stopId -> ${nextStop['stopId']}");
          
          // Force a UI update immediately
          service.invoke('update', {
            'status': 'ON_ROUTE',
            'lat': prefs.getDouble('last_lat'),
            'lng': prefs.getDouble('last_lng'),
            'nextStopId': nextStop['stopId'],
            'nextStopName': nextStop['name'],
          });
        }
      } else {
        debugPrint("[Background] Cannot skip last stop.");
      }
    } catch (e) {
      debugPrint("[Background] Manual skip error: $e");
    }
  }

  static Future<void> _handleArrivalEntry(
    SharedPreferences prefs,
    String collegeId,
    String busId,
    String tripId,
    String stopId,
    Position p,
  ) async {
    try {
      final db = FirebaseFirestore.instance;
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
        
        final batch = db.batch();

        // 1. Update Trip
        batch.update(tripRef, {
          'stopProgress.arrivedStopIds': arrivedIds,
          'stopProgress.arrivals': arrivals,
          'stopStatus.$stopId': 'ARRIVED',
        });

        // 2. Trigger Event for Student Notifications (Firestore fallback)
        final notifRef = db.collection('stopArrivals').doc();
        batch.set(notifRef, {
          'tripId': tripId,
          'busId': busId,
          'collegeId': collegeId,
          'stopId': stopId,
          'stopName': stops[currentIndex]['name'] ?? 'Stop',
          'type': 'ARRIVED',
          'arrivedAt': DateTime.now().toIso8601String(),
          'timestamp': DateTime.now().toIso8601String(),
          'processed': true, // Mark true because we will also call Node API
        });

        // 3. Update Bus
        batch.update(db.collection('buses').doc(busId), {
          'currentStatus': 'ARRIVED',
          'trackingMode': 'NEAR_STOP',
        });

        // 4. Trigger Server FCM (Step 5F) UNCONDITIONALLY BEFORE BATCH COMMIT
        // This prevents Android offline queueing from swallowing/delaying the HTTP dispatch
        _notifyServer(tripId, busId, collegeId, stopId, "ARRIVED", 
          stopName: stops[currentIndex]['name'],
          arrivalDocId: notifRef.id,
          prefs: prefs
        );

        await batch.commit();
      }
    } catch (e) {
      debugPrint("[Background] HandleArrivalEntry error: $e");
    }
  }

  static Future<void> _handleStopCompletion(
    SharedPreferences prefs,
    String collegeId,
    String busId,
    String tripId,
    String stopId,
  ) async {
    try {
      final db = FirebaseFirestore.instance;
      final tripRef = db.collection('trips').doc(tripId);
      final tripDoc = await tripRef.get();
      if (!tripDoc.exists) return;

      final data = tripDoc.data()!;
      final progress = data['stopProgress'] as Map<String, dynamic>? ?? {};
      final stops = (data['stopsSnapshot'] as List<dynamic>?) ?? [];
      final currentIndex = (progress['currentIndex'] as num?)?.toInt() ?? 0;

      final newIndex = currentIndex + 1;
      final isFinalStop = newIndex >= stops.length;

      final batch = db.batch();

      // 1. Update Trip Progress
      batch.update(tripRef, {
        'stopProgress.currentIndex': newIndex,
        'stopProgress.completedStopIds': FieldValue.arrayUnion([stopId]),
        'stopStatus.$stopId': 'COMPLETED',
      });

      // 2. Update Bus Status
      final Map<String, dynamic> busUpdate = {
        'currentStatus': 'MOVING',
        'trackingMode': 'FAR',
        'completedStops': FieldValue.arrayUnion([stopId]),
      };

      if (!isFinalStop) {
        final nextStop = stops[newIndex] as Map<String, dynamic>;
        busUpdate['nextStopId'] = nextStop['stopId'] as String;
        
        // Cache NEXT stop for isolate restart
        await prefs.setDouble('next_stop_lat', (nextStop['lat'] as num).toDouble());
        await prefs.setDouble('next_stop_lng', (nextStop['lng'] as num).toDouble());
        await prefs.setDouble('next_stop_radius', (nextStop['radiusM'] as num?)?.toDouble() ?? 100.0);
        await prefs.setString('next_stop_id', nextStop['stopId'] as String);
        await prefs.setString('next_stop_name', (nextStop['name'] as String?) ?? 'Stop');
        await prefs.setBool('has_arrived_current', false);

        batch.update(db.collection('buses').doc(busId), busUpdate);
        await batch.commit();
      } else {
        // AUTO-END
        debugPrint("[Background] AUTO-ENDING TRIP at final stop");

        // Notify students that trip ended UNCONDITIONALLY BEFORE BATCH COMMIT
        try {
          _notifyServer(tripId, busId, collegeId, '', 'TRIP_ENDED', prefs: prefs);
        } catch (e) {
          debugPrint('[Background] Trip ended notification failed: $e');
        }

        batch.update(tripRef, {
          'status': 'COMPLETED',
          'isActive': false,
          'endTime': DateTime.now().toIso8601String(),
          'endedAt': FieldValue.serverTimestamp(),
        });
        busUpdate['status'] = 'IDLE';
        busUpdate['activeTripId'] = null;
        
        await prefs.setBool('pending_finalize', true);
        await prefs.setString('pending_trip_id', tripId);
        await prefs.setString('pending_bus_id', busId);
        await prefs.setString('pending_college_id', collegeId);
        
        batch.update(db.collection('buses').doc(busId), busUpdate);
        await batch.commit(); // Ensure firestore is updated before finalization

        try {
           await TripFinalizer.finalizeTrip(
             collegeId: collegeId,
             busId: busId,
             tripId: tripId,
           );
        } catch(e) {
           debugPrint("[Background] Auto-finalize failed, will retry: $e");
        }

        // C-4 FIX: Explicitly reset _isRunning so a new trip can be started afterward.
        // The stopService listener may not fire in the same isolate context during auto-end.
        BackgroundTrackingService._isRunning = false;
        
        // Logic to stop self from background isolate safely
        // Historically FlutterBackgroundService().invoke("stopService") worked, 
        // but now throws "Only main isolate". The service logic in onStart already cleans up subscriptions.
        FlutterBackgroundService().invoke("stopService");
      }

    } catch (e) {
      debugPrint("[Background] HandleStopCompletion error: $e");
    }
  }

  static Map<String, String> _computeAdaptiveState(
    double distToNextStopM,
    String currentStatus,
    double radiusM,
    bool hasArrivedCurrent,
  ) {
    if (hasArrivedCurrent) {
       // We latch in ARRIVED even if GPS drifts slightly outside, 
       // until _handleStopCompletion explicitly moves us out with hysteresis.
       return {'mode': 'NEAR_STOP', 'status': 'ARRIVED'};
    }
    
    if (distToNextStopM <= radiusM) {
      return {'mode': 'NEAR_STOP', 'status': 'ARRIVED'};
    } else if (distToNextStopM <= _ARRIVING_DISTANCE_M) {
      return {'mode': 'NEAR_STOP', 'status': 'ARRIVING'};
    } else {
      return {'mode': 'FAR', 'status': 'ON_ROUTE'};
    }
  }

  /// Fire-and-forget call to the Node.js server to multicast FCM notifications.
  /// BUG FIX (Bug 1): Added missing auth token warning + full DioException logging
  /// so 401/400 errors are visible in logs instead of silently swallowed.
  static void _notifyServer(
    String tripId,
    String busId,
    String collegeId,
    String stopId,
    String type, {
    String? stopName,
    String? arrivalDocId,
    List<String>? targetStudentIds,
    SharedPreferences? prefs,
  }) async {
    try {
      final apiBase = prefs?.getString('api_base_url') ?? Env.apiUrl;
      
      // Use Firebase ID Token directly - this ensures it is ALWAYS fresh even in background isolate
      final user = FirebaseAuth.instance.currentUser;
      final token = await user?.getIdToken();

      if (token == null || token.isEmpty) {
        debugPrint('[NotifyServer] WARNING: No Firebase user or ID token — request will be unauthorized (401).');
      }

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
      ));

      if (type == 'TRIP_ENDED') {
        final response = await dio.post(
          '$apiBase/api/driver/trip-ended-notify',
          data: {
            'tripId': tripId,
            'busId': busId,
            'collegeId': collegeId,
          },
        );
        debugPrint('[NotifyServer] TRIP_ENDED success: ${response.statusCode}');
      } else {
        final response = await dio.post(
          '$apiBase/api/driver/stop-event',
          data: {
            'tripId': tripId,
            'busId': busId,
            'collegeId': collegeId,
            'stopId': stopId,
            'stopName': stopName ?? 'Stop',
            'type': type,
            if (arrivalDocId != null) 'arrivalDocId': arrivalDocId,
            if (targetStudentIds != null && targetStudentIds.isNotEmpty) 
              'targetStudentIds': targetStudentIds,
          },
        );
        debugPrint('[NotifyServer] $type success: ${response.statusCode} - ${response.data}');
      }
    } on DioException catch (e) {
      debugPrint('[NotifyServer] FAILED for $type at stopId=$stopId: ${e.message}');
      if (e.response != null) {
        debugPrint('[NotifyServer] Server response: ${e.response?.statusCode} — ${e.response?.data}');
      }
    } catch (e) {
      debugPrint('[NotifyServer] Unexpected error for $type at stopId=$stopId: $e');
    }
  }
}
