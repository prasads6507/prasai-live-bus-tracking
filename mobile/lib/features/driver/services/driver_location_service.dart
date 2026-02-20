import 'dart:async';
import 'dart:ui';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import '../../../data/models/location_point.dart';
import 'dart:io';

class DriverLocationService {
  static Future<void> initialize() async {
    final service = FlutterBackgroundService();

    // Setup local notifications for Android foreground service
    if (Platform.isAndroid) {
        FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
        const AndroidNotificationChannel channel = AndroidNotificationChannel(
          'my_foreground', 
          'MY FOREGROUND SERVICE', 
          description: 'This channel is used for important notifications.', 
          importance: Importance.high,
        );
        await flutterLocalNotificationsPlugin
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.createNotificationChannel(channel);
    }

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'my_foreground',
        initialNotificationTitle: 'Transit Hub Bus Driver',
        initialNotificationContent: 'Initializing Tracking...',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    return true;
  }

  @pragma('vm:entry-point')
  static void onStart(ServiceInstance service) async {
    DartPluginRegistrant.ensureInitialized();
    await Firebase.initializeApp();
    
    String? collegeId;
    String? busId;
    StreamSubscription<Position>? positionStream;

    service.on('setup').listen((event) {
      collegeId = event?['collegeId'];
      busId = event?['busId'];
    });

    service.on('stopService').listen((event) async {
      await positionStream?.cancel();
      service.stopSelf();
    });

    // 1Hz location updates with high precision (< 5m)
    positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
      ),
    ).listen((Position position) async {
      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
           service.setForegroundNotificationInfo(
            title: "Trip Active",
            content: "Speed: ${(position.speed * 2.23694).toStringAsFixed(1)} mph",
          );
        }
      }
      
      final point = LocationPoint(
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: DateTime.now(),
        speed: position.speed,
        heading: position.heading,
      );
      final pointMap = point.toMap();

      // Send to UI for dashboard updates
      service.invoke('locationUpdate', pointMap);

      // Direct Firestore push from isolated background thread
      if (collegeId != null && busId != null) {
          try {
             final db = FirebaseFirestore.instance;
             final busRef = db.collection('buses').doc(busId);
             
             final latlng = {'lat': position.latitude, 'lng': position.longitude};
             final trailPoint = {
               'lat': position.latitude,
               'lng': position.longitude,
               'timestamp': DateTime.now().toIso8601String()
             };

             await busRef.update({
                'location': {'latitude': position.latitude, 'longitude': position.longitude},
                'currentLocation': latlng,
                'speed': position.speed * 2.23694,
                'currentSpeed': position.speed * 2.23694,
                'heading': position.heading,
                'currentHeading': position.heading,
                'lastLocationUpdate': FieldValue.serverTimestamp(),
                'lastUpdated': DateTime.now().toIso8601String(),
                'liveTrail': FieldValue.arrayUnion([trailPoint]),
                'liveTrackBuffer': FieldValue.arrayUnion([trailPoint]),
             });
          } catch (e) {
             print("Background Tracking Error: $e");
          }
      }
    });
  }
}
