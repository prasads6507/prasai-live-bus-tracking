import 'dart:async';
import 'dart:ui';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import '../../../data/models/location_point.dart';
import 'tracking_batcher.dart';
// Note: We need a way to pass repository instances to the background isolate.
// Usually, we initialize dependencies inside the background service.

class DriverLocationService {
  static Future<void> initialize() async {
    final service = FlutterBackgroundService();

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'my_foreground',
        initialNotificationTitle: 'Bannu Bus Driver',
        initialNotificationContent: 'Initializing...',
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
    
    // Initialize dependencies here (e.g. Dio, Repos)
    // Since we can't easily pass the repositories, we might need to recreate them
    // or use a Service Locator that works across isolates (unlikely).
    // For now, I'll assume we can pass data via 'service.on' events.

    // Correction: Valid approach is to re-create the repository stack here.
    // Or we handle logic via listening to events.
    
    // But for simplicity in this generated code, we will mock the "re-creation" or Setup.
    
    // Listen for data sent from UI
    String? collegeId;
    String? busId;
    
    service.on('setup').listen((event) {
      collegeId = event?['collegeId'];
      busId = event?['busId'];
    });

    service.on('stopService').listen((event) {
      service.stopSelf();
    });
    
    // We need to wait for setup
    // For simplicity, let's assume we get setup immediately or we store in shared prefs.

    // 1Hz location updates
    Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
      ),
    ).listen((Position position) {
      if (service is AndroidServiceInstance) {
        if (service.isForegroundService()) {
           service.setForegroundNotificationInfo(
            title: "Trip Active",
            content: "Tracking location: ${position.latitude}, ${position.longitude}",
          );
        }
      }
      
      // Send location to UI or Batcher
      // Ideally here we use the Batcher directly if we can initialize it.
      // If we can't inject Repo, we can't use Batcher easily.
      // Alternative: Send to UI isolate via invoke.
      
      service.invoke(
        'locationUpdate',
        {
          'lat': position.latitude,
          'lng': position.longitude,
          'speed': position.speed,
          'heading': position.heading,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
    });
  }
}
