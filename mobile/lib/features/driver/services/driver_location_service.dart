import 'dart:async';
import 'dart:convert';
import 'dart:isolate';
import 'dart:math';
import 'dart:ui';
import 'package:background_location_tracker/background_location_tracker.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

import '../../../../core/config/env.dart';
import '../../../data/datasources/api_ds.dart';
import '../../../core/utils/polyline_encoder.dart';

// ─── ADAPTIVE TRACKING CONSTANTS ───
const double _ARRIVING_DISTANCE_M = 804.0;   // 0.5 mile
const double _ARRIVED_RADIUS_M = 100.0;       // Mark stop as reached
const double _ARRIVED_EXIT_M = 175.0;         // Hysteresis exit
const int _FAR_UPDATE_SEC = 20;               // Write interval in FAR mode
const int _NEAR_UPDATE_SEC = 5;               // Write interval in NEAR_STOP mode

double _sanitizeSpeedMps(double? v) {
  if (v == null) return 0;
  if (!v.isFinite) return 0;
  if (v < 0) return 0;
  return v;
}

int _speedMphRounded(double? mps) =>
  (_sanitizeSpeedMps(mps) * 2.236936).round();

/// Haversine distance in meters between two lat/lng points
double _haversineMeters(double lat1, double lon1, double lat2, double lon2) {
  const R = 6371000.0;
  final dLat = (lat2 - lat1) * (pi / 180);
  final dLon = (lon2 - lon1) * (pi / 180);
  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(lat1 * (pi / 180)) * cos(lat2 * (pi / 180)) *
      sin(dLon / 2) * sin(dLon / 2);
  final c = 2 * atan2(sqrt(a), sqrt(1 - a));
  return R * c;
}

/// Computes the adaptive mode and status based on distance to next stop.
/// Returns [mode, status] and respects hysteresis for ARRIVED.
Map<String, String> _computeAdaptiveState(
  double distToNextStopM,
  String currentStatus,
) {
  // Hysteresis: if currently ARRIVED, stay until bus exits 175m
  if (currentStatus == 'ARRIVED') {
    if (distToNextStopM <= _ARRIVED_EXIT_M) {
      return {'mode': 'NEAR_STOP', 'status': 'ARRIVED'};
    }
    // Exiting ARRIVED zone
  }

  if (distToNextStopM <= _ARRIVED_RADIUS_M) {
    return {'mode': 'NEAR_STOP', 'status': 'ARRIVED'};
  } else if (distToNextStopM <= _ARRIVING_DISTANCE_M) {
    return {'mode': 'NEAR_STOP', 'status': 'ARRIVING'};
  } else {
    return {'mode': 'FAR', 'status': 'ON_ROUTE'};
  }
}

int _getIntervalForMode(String mode) {
  return mode == 'NEAR_STOP' ? _NEAR_UPDATE_SEC : _FAR_UPDATE_SEC;
}

@pragma('vm:entry-point')
void backgroundCallback() {
  BackgroundLocationTrackerManager.handleBackgroundUpdated(
    (data) async {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      final collegeId = prefs.getString('track_college_id');
      final busId = prefs.getString('track_bus_id');
      final tripId = prefs.getString('track_trip_id');
      
      if (collegeId == null || busId == null) return;
      
      try {
        final rawLat = data.lat;
        final rawLng = data.lon;
        
        if (rawLat == 0.0 || rawLng == 0.0) return;

        final prevLat = prefs.getDouble('prev_lat');
        final prevLng = prefs.getDouble('prev_lng');
        final prevTimeStr = prefs.getString('prev_time');
        final nowTime = DateTime.now();

        double estMps = 0.0;
        double smoothedLat = rawLat;
        double smoothedLng = rawLng;

        if (prevLat != null && prevLng != null && prevTimeStr != null) {
          final prevTime = DateTime.parse(prevTimeStr);
          final dtSeconds = max(1, nowTime.difference(prevTime).inSeconds);
          final distMeters = _haversineMeters(prevLat, prevLng, rawLat, rawLng);

          estMps = distMeters / dtSeconds;
          if (estMps > 60.0) return; // Drop bad point (jump > 134mph)

          final double alpha = (estMps > 2.0) ? 0.9 : 0.7; 
          smoothedLat = alpha * rawLat + (1 - alpha) * prevLat;
          smoothedLng = alpha * rawLng + (1 - alpha) * prevLng;
        }

        final pluginSpeed = _sanitizeSpeedMps(data.speed);
        double finalSpeedMps = pluginSpeed;
        if (pluginSpeed <= 0.05 && prevLat != null && prevTimeStr != null) {
          finalSpeedMps = estMps;
        }
        if (finalSpeedMps > 45.0) finalSpeedMps = 45.0;
        
        final speedMph = _speedMphRounded(finalSpeedMps);

        // Update prev point
        await prefs.setDouble('prev_lat', smoothedLat);
        await prefs.setDouble('prev_lng', smoothedLng);
        await prefs.setString('prev_time', nowTime.toIso8601String());

        // ─── LOCAL BUFFER for trip history (unchanged — single upload at trip end) ───
        final newPoint = {
          'lat': smoothedLat,
          'lng': smoothedLng,
          'speed': speedMph,
          'heading': data.course,
          'timestamp': nowTime.toIso8601String(),
        };

        final existingBuffer = prefs.getString('trip_history_buffer') ?? '[]';
        List<dynamic> buffer;
        try {
          buffer = existingBuffer.isNotEmpty
            ? List<dynamic>.from(jsonDecode(existingBuffer) as List)
            : [];
        } catch (_) {
          buffer = [];
        }
        buffer.add(newPoint);
        if (buffer.length > 10000) {
          buffer.removeRange(0, buffer.length - 10000);
        }
        await prefs.setString('trip_history_buffer', jsonEncode(buffer));
        await prefs.setInt('trip_buffer_count', buffer.length);

        // ─── ADAPTIVE MODE STATE MACHINE ───
        // Load previous state
        String prevMode = prefs.getString('adaptive_mode') ?? 'FAR';
        String prevStatus = prefs.getString('adaptive_status') ?? 'ON_ROUTE';
        String prevNextStopId = prefs.getString('adaptive_next_stop_id') ?? '';
        final lastWriteMs = prefs.getInt('last_firestore_write_ms') ?? 0;

        // Load cached next stop coordinates
        final nextStopLat = prefs.getDouble('next_stop_lat');
        final nextStopLng = prefs.getDouble('next_stop_lng');
        final nextStopId = prefs.getString('next_stop_id') ?? '';

        // Compute distance to next stop
        double distToNextStop = double.infinity;
        if (nextStopLat != null && nextStopLng != null && nextStopLat != 0.0) {
          distToNextStop = _haversineMeters(smoothedLat, smoothedLng, nextStopLat, nextStopLng);
        }

        // Compute new mode and status
        final newState = _computeAdaptiveState(distToNextStop, prevStatus);
        final newMode = newState['mode']!;
        final newStatus = newState['status']!;

        // Determine if we should write to Firestore
        final elapsedMs = nowTime.millisecondsSinceEpoch - lastWriteMs;
        final intervalMs = _getIntervalForMode(newMode) * 1000;

        // Smart triggers: force write on significant movement changes
        final prevHeading = prefs.getDouble('prev_heading') ?? data.course;
        final prevSpeed = prefs.getInt('prev_speed_mph') ?? 0;
        
        double headingDiff = (data.course - prevHeading).abs();
        if (headingDiff > 180) headingDiff = 360 - headingDiff;
        final bool sharpTurn = headingDiff > 25.0 && finalSpeedMps > 2.0;
        final bool speedChange = (speedMph - prevSpeed).abs() > 10;

        final modeChanged = newMode != prevMode;
        final statusChanged = newStatus != prevStatus;
        final nextStopChanged = nextStopId != prevNextStopId;
        final intervalElapsed = elapsedMs >= intervalMs;

        final shouldWrite = modeChanged || statusChanged || nextStopChanged || intervalElapsed || sharpTurn || speedChange;

        // Save state regardless
        await prefs.setString('adaptive_mode', newMode);
        await prefs.setString('adaptive_status', newStatus);
        await prefs.setString('adaptive_next_stop_id', nextStopId);
        await prefs.setDouble('prev_heading', data.course);
        await prefs.setInt('prev_speed_mph', speedMph);

        if (!shouldWrite) {
          debugPrint("[Adaptive] SKIP write | mode=$newMode status=$newStatus elapsed=${elapsedMs}ms < ${intervalMs}ms");
          // Still send to foreground isolate for UI updates
          _sendToForeground(data);
          return;
        }

        // ─── FIRESTORE WRITE (adaptive-gated) ───
        final db = FirebaseFirestore.instance;

        try {
          await db.collection('buses').doc(busId).update({
            'lastUpdated': nowTime.toIso8601String(),
            'lastLocationUpdate': FieldValue.serverTimestamp(),
            'location': {
              'latitude': smoothedLat,
              'longitude': smoothedLng,
              'heading': data.course,
            },
            'currentLocation': {
              'latitude': smoothedLat,
              'longitude': smoothedLng,
              'lat': smoothedLat,
              'lng': smoothedLng,
              'heading': data.course,
            },
            'speed': speedMph,
            'speedMph': speedMph,
            'speedMPH': speedMph,
            'currentSpeed': speedMph,
            'heading': data.course,
            'currentHeading': data.course,
            'status': 'ON_ROUTE', // Bus overall status while trip exists
            'currentStatus': newStatus, // Moving/Arriving/Arrived
            'trackingMode': newMode,
            'nextStopId': nextStopId,
          });

          await prefs.setInt('last_firestore_write_ms', nowTime.millisecondsSinceEpoch);

          debugPrint("[Adaptive] WRITE | mode=$newMode status=$newStatus speed=${speedMph}mph "
              "dist=${distToNextStop.round()}m turn=$sharpTurn speedChg=$speedChange reason=${modeChanged ? 'MODE_CHANGE' : statusChanged ? 'STATUS_CHANGE' : nextStopChanged ? 'STOP_CHANGE' : 'INTERVAL'}");
        } catch (e) {
          debugPrint("[Adaptive] Firestore write failed: $e");
        }

        // ─── GEOFENCE + STOP ARRIVAL DETECTION ───
        if (tripId != null && tripId.isNotEmpty) {
          try {
            final busRef = db.collection('buses').doc(busId);
            final busDoc = await busRef.get();
            final geoData = busDoc.data();

            if (geoData != null && geoData['activeTripId'] != null) {
              final String activeTripId = geoData['activeTripId'] as String;
              final tripRef = db.collection('trips').doc(activeTripId);
              final tripDoc = await tripRef.get();

              if (tripDoc.exists) {
                final tripData = tripDoc.data()!;
                final stops = (tripData['stopsSnapshot'] as List<dynamic>?) ?? [];
                final progress = tripData['stopProgress'] as Map<String, dynamic>? ?? {};
                final currentIndex = (progress['currentIndex'] as num?)?.toInt() ?? 0;
                final arrivedIds = List<String>.from(progress['arrivedStopIds'] ?? []);
                final arrivals = Map<String, dynamic>.from(progress['arrivals'] ?? {});

                if (currentIndex < stops.length) {
                  final nextStop = stops[currentIndex] as Map<String, dynamic>;
                  final stopLat = (nextStop['lat'] as num?)?.toDouble() ?? 0;
                  final stopLng = (nextStop['lng'] as num?)?.toDouble() ?? 0;
                  final stopId = nextStop['stopId'] as String? ?? '';

                  // Cache next stop coordinates for adaptive mode computation
                  await prefs.setDouble('next_stop_lat', stopLat);
                  await prefs.setDouble('next_stop_lng', stopLng);
                  await prefs.setString('next_stop_id', stopId);

                  final distM = _haversineMeters(smoothedLat, smoothedLng, stopLat, stopLng);

                  // Check geofence with updated 100m radius
                  if (distM <= _ARRIVED_RADIUS_M && !arrivedIds.contains(stopId)) {
                    arrivedIds.add(stopId);
                    arrivals[stopId] = nowTime.toIso8601String();
                    final newIndex = currentIndex + 1;
                    final newNextStopId = newIndex < stops.length
                        ? (stops[newIndex] as Map<String, dynamic>)['stopId']
                        : null;

                    await tripRef.update({
                      'stopProgress.currentIndex': newIndex,
                      'stopProgress.arrivedStopIds': arrivedIds,
                      'stopProgress.arrivals': arrivals,
                      'eta.nextStopId': newNextStopId,
                    });

                    // Update cached next stop to the NEW next stop
                    if (newIndex < stops.length) {
                      final newNextStop = stops[newIndex] as Map<String, dynamic>;
                      await prefs.setDouble('next_stop_lat', (newNextStop['lat'] as num?)?.toDouble() ?? 0);
                      await prefs.setDouble('next_stop_lng', (newNextStop['lng'] as num?)?.toDouble() ?? 0);
                      await prefs.setString('next_stop_id', newNextStop['stopId'] as String? ?? '');
                    }

                    // Auto End Trip at final stop
                    if (newIndex >= stops.length) {
                      debugPrint("[Adaptive] AUTO-ENDING TRIP at final stop");

                      // 1. Mark bus as ending to prevent UI logic bugs while API runs
                      await busRef.update({
                        'status': 'IDLE',
                        'currentStatus': 'MOVING',
                        'speedMph': 0,
                      });
                      
                      // 2. Trigger history upload BEFORE ending trip
                      await DriverLocationService.uploadBufferedHistory(activeTripId);

                      // 3. Call the server API to atomically end trip (same as manual)
                      try {
                        final dio = Dio();
                        await dio.post(
                          '${Env.apiUrl}/api/driver/trips/$activeTripId/end',
                          data: {
                            'collegeId': collegeId,
                            'busId': busId,
                          },
                        );
                        debugPrint("[Adaptive] Auto-end trip API called successfully");
                      } catch (e) {
                         debugPrint("[Adaptive] Auto-end API failed: $e. Falling back to native firestore updates.");
                         await tripRef.update({
                           'status': 'COMPLETED',
                           'endTime': nowTime.toIso8601String(),
                           'isActive': false,
                           'endedAt': FieldValue.serverTimestamp(),
                         });
                         await busRef.update({
                           'activeTripId': FieldValue.delete(),
                           'currentTripId': FieldValue.delete(),
                           'trackingMode': FieldValue.delete(),
                           'nextStopId': FieldValue.delete(),
                         });
                      }
                    }

                    // Write arrival event for push notification trigger
                    await db.collection('stopArrivals').add({
                      'tripId': activeTripId,
                      'busId': busId,
                      'collegeId': collegeId,
                      'routeId': geoData['routeId'] ?? '',
                      'stopId': stopId,
                      'stopName': nextStop['name'] ?? '',
                      'arrivedAt': nowTime.toIso8601String(),
                      'processed': false,
                    });

                    debugPrint("[Adaptive] ARRIVED at stop: $stopId (${nextStop['name']})");
                  } else if (!arrivedIds.contains(stopId)) {
                    // ETA computation
                    final currentSpeedMps = (data.speed > 1.5) ? data.speed : 3.0;
                    final etaSeconds = distM / currentSpeedMps;
                    final nextStopEta = nowTime.add(Duration(seconds: etaSeconds.round())).toIso8601String();

                    await tripRef.update({
                      'eta.nextStopEta': nextStopEta,
                      'eta.delayMinutes': 0,
                    });
                  }
                }
              }
            }
          } catch (e) {
            debugPrint("[Adaptive] Geofence check error: $e");
          }
        }
      } catch (e) {
        debugPrint("[Adaptive] Background callback error: $e");
      }
      
      // Send data to foreground isolate
      _sendToForeground(data);
    },
  );
}

void _sendToForeground(BackgroundLocationUpdateData data) {
  final SendPort? sendPort = IsolateNameServer.lookupPortByName("LocatorIsolate");
  if (sendPort != null) {
    sendPort.send({
      'lat': data.lat,
      'lon': data.lon,
      'speed': data.speed,
      'course': data.course,
    });
  }
}

class DriverLocationService {
  static ReceivePort? _port;
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    await BackgroundLocationTrackerManager.initialize(
      backgroundCallback,
      config: const BackgroundLocationTrackerConfig(
        loggingEnabled: false,
        androidConfig: AndroidConfig(
          notificationIcon: 'ic_launcher',
          trackingInterval: Duration(seconds: 5),
          distanceFilterMeters: 5,
        ),
        iOSConfig: IOSConfig(
          activityType: ActivityType.FITNESS,
          distanceFilterMeters: 5,
          restartAfterKill: true,
        ),
      ),
    );
    _initialized = true;
  }

  static Future<void> startTracking(String collegeId, String busId, String tripId, Function(BackgroundLocationUpdateData) onLocationUpdate) async {
    if (!_initialized) await initialize();
    
    // Save IDs for the background isolate
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('track_college_id', collegeId);
    await prefs.setString('track_bus_id', busId);
    await prefs.setString('track_trip_id', tripId);

    // Initialize adaptive state
    await prefs.setString('adaptive_mode', 'FAR');
    await prefs.setString('adaptive_status', 'ON_ROUTE');
    await prefs.setString('adaptive_next_stop_id', '');
    await prefs.setInt('last_firestore_write_ms', 0);

    // Cache next stop from trip document
    try {
      final db = FirebaseFirestore.instance;
      final tripDoc = await db.collection('trips').doc(tripId).get();
      if (tripDoc.exists) {
        final tripData = tripDoc.data()!;
        final stops = (tripData['stopsSnapshot'] as List<dynamic>?) ?? [];
        final progress = tripData['stopProgress'] as Map<String, dynamic>? ?? {};
        final currentIndex = (progress['currentIndex'] as num?)?.toInt() ?? 0;

        if (currentIndex < stops.length) {
          final nextStop = stops[currentIndex] as Map<String, dynamic>;
          await prefs.setDouble('next_stop_lat', (nextStop['lat'] as num?)?.toDouble() ?? 0);
          await prefs.setDouble('next_stop_lng', (nextStop['lng'] as num?)?.toDouble() ?? 0);
          await prefs.setString('next_stop_id', nextStop['stopId'] as String? ?? '');
          debugPrint("[Adaptive] Cached next stop: ${nextStop['name']} at index $currentIndex");
        }
      }
    } catch (e) {
      debugPrint("[Adaptive] Failed to cache trip stops: $e");
    }

    _port?.close();
    _port = ReceivePort();
    IsolateNameServer.removePortNameMapping("LocatorIsolate");
    IsolateNameServer.registerPortWithName(_port!.sendPort, "LocatorIsolate");

    _port!.listen((dynamic data) {
      if (data != null && data is Map) {
        final point = BackgroundLocationUpdateData(
          lat: data['lat'] ?? 0.0,
          lon: data['lon'] ?? 0.0,
          speed: data['speed'] ?? 0.0,
          course: data['course'] ?? 0.0,
          horizontalAccuracy: 0.0,
          alt: 0.0,
          verticalAccuracy: 0.0,
          courseAccuracy: 0.0,
          speedAccuracy: 0.0,
        );
        onLocationUpdate(point);
      }
    });

    await BackgroundLocationTrackerManager.startTracking();
  }

  static Future<void> stopTracking() async {
    IsolateNameServer.removePortNameMapping("LocatorIsolate");
    _port?.close();
    _port = null;
    
    await BackgroundLocationTrackerManager.stopTracking();
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('track_college_id');
    await prefs.remove('track_bus_id');
    // Clean adaptive state
    await prefs.remove('adaptive_mode');
    await prefs.remove('adaptive_status');
    await prefs.remove('adaptive_next_stop_id');
    await prefs.remove('last_firestore_write_ms');
    await prefs.remove('next_stop_lat');
    await prefs.remove('next_stop_lng');
    await prefs.remove('next_stop_id');
  }

  static Future<void> uploadBufferedHistory(String tripId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    try {
      final existingBuffer = prefs.getString('trip_history_buffer');
      if (existingBuffer != null && existingBuffer.isNotEmpty) {
        final rawBuffer = List<Map<String, dynamic>>.from(jsonDecode(existingBuffer));
        if (rawBuffer.isNotEmpty) {
          // 1. Compression logic
          final List<Map<String, dynamic>> compressed = [];
          compressed.add(rawBuffer.first);

          for (int i = 1; i < rawBuffer.length - 1; i++) {
            final curr = rawBuffer[i];
            final prev = compressed.last;

            double dist = _haversineMeters(
              (prev['lat'] as num).toDouble(), (prev['lng'] as num).toDouble(),
              (curr['lat'] as num).toDouble(), (curr['lng'] as num).toDouble(),
            );

            double headingDiff = (((curr['heading'] as num?)?.toDouble() ?? 0) - 
                                 ((prev['heading'] as num?)?.toDouble() ?? 0)).abs();
            if (headingDiff > 180) headingDiff = 360 - headingDiff;

            if (dist > 10.0 || headingDiff > 15.0) {
              compressed.add(curr);
            }
          }

          if (rawBuffer.length > 1) {
            compressed.add(rawBuffer.last);
          }

          // 2. Metrics Calculation
          double totalDistM = 0;
          double maxSpeedMph = 0;
          double sumSpeedMph = 0;
          final coords = <List<double>>[];

          for (int i = 0; i < compressed.length; i++) {
            final point = compressed[i];
            final lat = (point['lat'] as num).toDouble();
            final lng = (point['lng'] as num).toDouble();
            final speed = (point['speed'] as num).toDouble();

            coords.add([lat, lng]);
            if (speed > maxSpeedMph) maxSpeedMph = speed;
            sumSpeedMph += speed;

            if (i > 0) {
              final prev = compressed[i - 1];
              totalDistM += _haversineMeters(
                (prev['lat'] as num).toDouble(), (prev['lng'] as num).toDouble(),
                lat, lng,
              );
            }
          }

          final firstTs = DateTime.parse(compressed.first['timestamp']);
          final lastTs = DateTime.parse(compressed.last['timestamp']);
          final durationSec = lastTs.difference(firstTs).inSeconds.abs();

          final String polyline = PolylineEncoder.encode(coords);

          // 3. Upload to API
          await ApiDataSource(Dio(), FirebaseFirestore.instance).uploadTripHistory(
            tripId,
            polyline: polyline,
            distanceMeters: totalDistM.round(),
            durationSeconds: durationSec,
            maxSpeedMph: maxSpeedMph.round(),
            avgSpeedMph: compressed.isNotEmpty ? (sumSpeedMph / compressed.length).round() : 0,
            pointsCount: compressed.length,
            path: compressed,
          );
          
          debugPrint("Successfully uploaded trip history for $tripId (${compressed.length} compressed points)");
        }
      }
    } catch (e) {
      debugPrint("Failed to upload buffered trip history: $e");
    } finally {
      await prefs.remove('trip_history_buffer');
      await prefs.remove('trip_buffer_count');
      await prefs.remove('prev_lat');
      await prefs.remove('prev_lng');
      await prefs.remove('prev_time');
    }
  }
}
