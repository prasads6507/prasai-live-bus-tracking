import 'dart:async';
import 'dart:isolate';
import 'dart:ui';
import 'package:background_location_tracker/background_location_tracker.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../data/models/location_point.dart';
import '../../../core/config/env.dart';

@pragma('vm:entry-point')
void backgroundCallback() {
  BackgroundLocationTrackerManager.handleBackgroundUpdated(
    (data) async {
      await Firebase.initializeApp();
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      final collegeId = prefs.getString('track_college_id');
      final busId = prefs.getString('track_bus_id');
      
      if (collegeId == null || busId == null) return;
      
      try {
        final speedMph = data.speed * 2.23694;
        
        final db = FirebaseFirestore.instance;
        final busRef = db.collection('buses').doc(busId);
        
        await db.runTransaction((transaction) async {
          final snapshot = await transaction.get(busRef);
          if (!snapshot.exists) return;
          
          final dataMap = snapshot.data();
          if (dataMap == null) return;
          
          final isActiveTrip = dataMap['activeTripId'] != null;
          final newStatus = isActiveTrip ? 'ON_ROUTE' : (dataMap['status'] == 'MAINTENANCE' ? 'MAINTENANCE' : 'ACTIVE');
          
          final currentBuffer = List.from(dataMap['liveTrackBuffer'] ?? []);
          final newPoint = {
            'latitude': data.lat,
            'longitude': data.lon,
            'speed': speedMph,
            'heading': data.course,
            'timestamp': DateTime.now().toIso8601String(),
          };
          
          currentBuffer.add(newPoint);
          if (currentBuffer.length > 5) {
            currentBuffer.removeRange(0, currentBuffer.length - 5);
          }
          
          transaction.update(busRef, {
            'status': newStatus,
            'lastUpdated': DateTime.now().toIso8601String(),
            'lastLocationUpdate': FieldValue.serverTimestamp(),
            'location': {
              'latitude': data.lat,
              'longitude': data.lon,
              'heading': data.course,
            },
            'currentLocation': {
              'lat': data.lat,
              'lng': data.lon,
            },
            'speed': speedMph,
            'currentSpeed': speedMph,
            'heading': data.course,
            'liveTrackBuffer': currentBuffer,
          });

          if (isActiveTrip) {
            final historyRef = db.collection('trips').doc(dataMap['activeTripId'] as String).collection('history').doc();
            transaction.set(historyRef, {
              'lat': data.lat,
              'lng': data.lon,
              'speed': speedMph,
              'heading': data.course,
              'recordedAt': FieldValue.serverTimestamp(),
              'timestamp': DateTime.now().toIso8601String(),
            });
          }
        });
      } catch (e) {
        // Silent fail in background allowed to keep isolate running on network drops
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
}
