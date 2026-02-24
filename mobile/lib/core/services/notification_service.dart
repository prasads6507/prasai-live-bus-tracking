import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings initializationSettingsIOS = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _notificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap
      },
    );

    // Create channel for Android
    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'bus_events',
      'Bus Events',
      description: 'Notifications for bus arrivals and skips',
      importance: Importance.max,
    );

    await _notificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  static Future<void> showArrivalNotification(String stopName) async {
    await _showNotification(
      id: 1,
      title: 'Bus Arrived',
      body: 'The bus has arrived at $stopName',
    );
  }

  static Future<void> showSkipNotification(String stopName) async {
    await _showNotification(
      id: 2,
      title: 'Bus Heading to Next Stop',
      body: 'Bus is now heading to its next destination (continuing from $stopName)',
    );
  }

  static Future<void> _showNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'bus_events',
      'Bus Events',
      channelDescription: 'Notifications for bus arrivals and skips',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'ticker',
    );

    const NotificationDetails platformDetails = NotificationDetails(
      android: androidDetails,
      iOS: DarwinNotificationDetails(),
    );

    await _notificationsPlugin.show(id, title, body, platformDetails);
  }
}
