import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(
      settings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {},
    );

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'bus_events',
      'Bus Events',
      description: 'Live bus arrival and stop notifications',
      importance: Importance.max,
      playSound: true,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  /// Bus entered 0.5 mile radius — "Stop Name, Arriving Soon"
  static Future<void> showArrivingNotification(String stopName) async {
    await _show(
      id: 10,
      title: 'Bus Arriving Soon',
      body: '$stopName, Arriving Soon',
    );
  }

  /// Bus entered 100m radius — "Bus has arrived at Stop Name"
  static Future<void> showArrivedNotification(String stopName) async {
    await _show(
      id: 11,
      title: 'Bus Arrived',
      body: 'Bus has arrived at $stopName',
    );
  }

  /// Bus skipped a stop
  static Future<void> showSkipNotification(String stopName) async {
    await _show(
      id: 12,
      title: 'Stop Skipped',
      body: 'Bus skipped $stopName — heading to next stop',
    );
  }

  // Backward compatibility alias
  static Future<void> showArrivalNotification(String stopName) =>
      showArrivedNotification(stopName);

  static Future<void> _show({
    required int id,
    required String title,
    required String body,
  }) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'bus_events',
      'Bus Events',
      channelDescription: 'Live bus arrival and stop notifications',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'Bus update',
      enableVibration: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );

    await _plugin.show(id, title, body, details);
  }
}
