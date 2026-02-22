import 'dart:async';
import 'dart:convert';
import 'dart:isolate';
import 'dart:math';
import 'dart:ui';
import 'package:background_location_tracker/background_location_tracker.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

import '../../data/datasources/api_ds.dart';
import '../../core/utils/polyline_encoder.dart';

double _sanitizeSpeedMps(double? v) {
  if (v == null) return 0;
  if (!v.isFinite) return 0;
  if (v < 0) return 0; // INVALID => clamp
  return v;
}

int _speedMphRounded(double? mps) =>
  (_sanitizeSpeedMps(mps) * 2.236936).round();

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

          smoothedLat = 0.7 * rawLat + 0.3 * prevLat;
          smoothedLng = 0.7 * rawLng + 0.3 * prevLng;
        }

        final pluginSpeed = _sanitizeSpeedMps(data.speed);
        double finalSpeedMps = pluginSpeed > 0 ? pluginSpeed : estMps;
        if (finalSpeedMps > 45.0) finalSpeedMps = 45.0; // clamp max ~100mph
        final speedMph = _speedMphRounded(finalSpeedMps);

        // Update prev point
        await prefs.setDouble('prev_lat', smoothedLat);
        await prefs.setDouble('prev_lng', smoothedLng);
        await prefs.setString('prev_time', nowTime.toIso8601String());

        // ─── LOCAL BUFFER instead of Firestore writes ───
        // Buffer GPS points locally; they'll be uploaded in one batch at trip end.
        // This eliminates ALL Firestore writes from background tracking.

        final newPoint = {
          'lat': smoothedLat,
          'lng': smoothedLng,
          'speed': speedMph,
          'heading': data.course,
          'timestamp': nowTime.toIso8601String(),
        };

        // Append to SharedPreferences buffer
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

        // Cap at 10,000 points (~3 hour trip at 1 point/5sec)
        if (buffer.length > 10000) {
          buffer.removeRange(0, buffer.length - 10000);
        }

        await prefs.setString('trip_history_buffer', jsonEncode(buffer));
        await prefs.setInt('trip_buffer_count', buffer.length);

        // --- Geofence + ETA check (fire-and-forget, reads only) ---
        final db = FirebaseFirestore.instance;
        final busRef = db.collection('buses').doc(busId);
        final busDocForGeofence = await busRef.get();
        final geoData = busDocForGeofence.data();
        if (geoData != null && geoData['activeTripId'] != null) {
          try {
            final String tripId = geoData['activeTripId'] as String;
            final tripRef = db.collection('trips').doc(tripId);
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
                final radiusM = (nextStop['radiusM'] as num?)?.toDouble() ?? 100;
                final stopId = nextStop['stopId'] as String? ?? '';

                // Haversine distance in meters
                final distM = _haversineMeters(data.lat, data.lon, stopLat, stopLng);

                // Check geofence
                if (distM <= radiusM && !arrivedIds.contains(stopId)) {
                  arrivedIds.add(stopId);
                  arrivals[stopId] = DateTime.now().toIso8601String();
                  final newIndex = currentIndex + 1;
                  final nextStopId = newIndex < stops.length
                      ? (stops[newIndex] as Map<String, dynamic>)['stopId']
                      : null;

                  await tripRef.update({
                    'stopProgress.currentIndex': newIndex,
                    'stopProgress.arrivedStopIds': arrivedIds,
                    'stopProgress.arrivals': arrivals,
                    'eta.nextStopId': nextStopId,
                  });

                  // F1: Auto End Trip when reaching the final stop
                  if (newIndex >= stops.length) {
                    await tripRef.update({
                      'status': 'COMPLETED',
                      'endTime': DateTime.now().toIso8601String(),
                    });
                    
                    await busRef.update({
                      'status': 'ACTIVE',
                      'activeTripId': FieldValue.delete(),
                    });
                  }

                  // Write arrival event for push notification trigger
                  await db.collection('stopArrivals').add({
                    'tripId': tripId,
                    'busId': busId,
                    'collegeId': collegeId,
                    'routeId': geoData['routeId'] ?? '',
                    'stopId': stopId,
                    'stopName': nextStop['name'] ?? '',
                    'arrivedAt': DateTime.now().toIso8601String(),
                    'processed': false,
                  });
                } else {
                  // Compute ETA to next stop
                  final speedMps = (data.speed > 1) ? data.speed * 0.44704 : 3.0; // mph to m/s, min 3 m/s
                  final etaSeconds = distM / speedMps;
                  final nextStopEta = DateTime.now().add(Duration(seconds: etaSeconds.round())).toIso8601String();

                  await tripRef.update({
                    'eta.nextStopEta': nextStopEta,
                    'eta.delayMinutes': 0, // simplified for now
                  });
                }
              }
            }
          } catch (_) {
            // Silent fail — ETA/geofence is best-effort
          }
        }
      } catch (_) {
        // Silent fail in background for network drops or missing data
      }
      
      // Send data to foreground isolate if it's running
      final SendPort? sendPort = IsolateNameServer.lookupPortByName("LocatorIsolate");
      if (sendPort != null) {
        // Pass map to avoid passing complex object types across isolates if they fail
        sendPort.send({
          'lat': data.lat,
          'lon': data.lon,
          'speed': data.speed,
          'course': data.course,
        });
      }
    },
  );
}

/// Haversine distance in meters between two lat/lng points
double _haversineMeters(double lat1, double lon1, double lat2, double lon2) {
  const R = 6371000.0; // Earth radius in meters
  final dLat = (lat2 - lat1) * (pi / 180);
  final dLon = (lon2 - lon1) * (pi / 180);
  final a = sin(dLat / 2) * sin(dLat / 2) +
      cos(lat1 * (pi / 180)) * cos(lat2 * (pi / 180)) *
      sin(dLon / 2) * sin(dLon / 2);
  final c = 2 * atan2(sqrt(a), sqrt(1 - a));
  return R * c;
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

  static Future<void> startTracking(String collegeId, String busId, Function(BackgroundLocationUpdateData) onLocationUpdate) async {
    if (!_initialized) await initialize();
    
    // Save IDs for the background isolate
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('track_college_id', collegeId);
    await prefs.setString('track_bus_id', busId);

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
  }

  static Future<void> uploadBufferedHistory(String tripId) async {
    final prefs = await SharedPreferences.getInstance();
    try {
      final existingBuffer = prefs.getString('trip_history_buffer');
      if (existingBuffer != null && existingBuffer.isNotEmpty) {
        final buffer = List<dynamic>.from(jsonDecode(existingBuffer));
        if (buffer.isNotEmpty) {
          double totalDistM = 0;
          double maxSpeedMph = 0;
          double sumSpeedMph = 0;
          final coords = <List<double>>[];

          for (int i = 0; i < buffer.length; i++) {
            final point = buffer[i];
            final lat = (point['lat'] as num).toDouble();
            final lng = (point['lng'] as num).toDouble();
            final speed = (point['speed'] as num).toDouble();

            coords.add([lat, lng]);
            if (speed > maxSpeedMph) maxSpeedMph = speed;
            sumSpeedMph += speed;

            if (i > 0) {
              final prev = buffer[i - 1];
              totalDistM += _haversineMeters(
                (prev['lat'] as num).toDouble(), (prev['lng'] as num).toDouble(),
                lat, lng,
              );
            }
          }

          final firstTs = DateTime.parse(buffer.first['timestamp']);
          final lastTs = DateTime.parse(buffer.last['timestamp']);
          final durationSec = lastTs.difference(firstTs).inSeconds.abs();

          final String polyline = PolylineEncoder.encode(coords);

          await ApiDataSource().uploadTripHistory(
            tripId,
            polyline: polyline,
            distanceMeters: totalDistM.round(),
            durationSeconds: durationSec,
            maxSpeedMph: maxSpeedMph.round(),
            avgSpeedMph: (sumSpeedMph / buffer.length).round(),
            pointsCount: buffer.length,
          );
          
          debugPrint("Successfully uploaded trip history for $tripId (${buffer.length} points, compressed to polyline)");
        }
      }
    } catch (e) {
      debugPrint("Failed to upload buffered trip history: $e");
    } finally {
      await prefs.remove('trip_history_buffer');
      await prefs.remove('trip_buffer_count');
    }
  }
}
