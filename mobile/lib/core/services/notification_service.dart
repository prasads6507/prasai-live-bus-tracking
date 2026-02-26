import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

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
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        debugPrint('[Notification] Tapped: ${response.payload}');
      },
    );

    // Create high-importance notification channel for Android
    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'bus_events',
      'Bus Events',
      description: 'Live bus arrival and stop notifications',
      importance: Importance.max,
      playSound: true,
    );

    final androidPlugin = _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    if (androidPlugin != null) {
      await androidPlugin.createNotificationChannel(channel);
      // CRITICAL: Request POST_NOTIFICATIONS permission on Android 13+
      final granted = await androidPlugin.requestNotificationsPermission();
      debugPrint('[NotificationService] Android notification permission granted: $granted');
    }

    // Also request from Firebase Messaging (covers iOS + fallback)
    final messagingSettings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    debugPrint('[NotificationService] FCM permission: ${messagingSettings.authorizationStatus}');

    _initialized = true;
    debugPrint('[NotificationService] Initialized successfully');
  }

  // ─── Specific Notification Types ─────────────────────────────────────────

  /// Notification 1: Bus started its trip
  static Future<void> showBusStartedNotification(String busNumber) async {
    await _show(
      id: 'bus_started_$busNumber'.hashCode.abs() % 100000,
      title: 'Bus Started 🚌',
      body: 'Bus $busNumber has started its trip. Track it live!',
    );
  }

  /// Notification 2: Bus entering 0.5 mile radius — "Arriving Soon"
  static Future<void> showArrivingNotification(String stopName) async {
    await _show(
      id: 'arriving_$stopName'.hashCode.abs() % 100000,
      title: 'Bus Arriving Soon 🚍',
      body: '$stopName, Arriving Soon',
    );
  }

  /// Notification 3: Bus entered 100m radius — "Arrived"
  static Future<void> showArrivedNotification(String stopName) async {
    await _show(
      id: 'arrived_$stopName'.hashCode.abs() % 100000,
      title: 'Bus Arrived ✅',
      body: 'Bus has arrived at $stopName',
    );
  }

  /// Notification 4: Trip completed
  static Future<void> showTripEndedNotification(String busNumber) async {
    await _show(
      id: 'trip_ended_$busNumber'.hashCode.abs() % 100000,
      title: 'Trip Completed 🏁',
      body: 'Bus $busNumber has completed its trip for today.',
    );
  }

  /// Stop skipped
  static Future<void> showSkipNotification(String stopName) async {
    await _show(
      id: 'skipped_$stopName'.hashCode.abs() % 100000,
      title: 'Stop Skipped ⏭',
      body: 'Bus skipped $stopName — heading to next stop',
    );
  }

  // Backward compatibility alias
  static Future<void> showArrivalNotification(String stopName) =>
      showArrivedNotification(stopName);

  // ─── FCM Message Handler (called from main.dart) ──────────────────────────

  /// Call this from main.dart inside FirebaseMessaging.onMessage.listen()
  /// Handles FCM messages when app is in FOREGROUND.
  static Future<void> handleForegroundMessage(RemoteMessage message) async {
    debugPrint('[FCM Foreground] ${message.notification?.title}: ${message.notification?.body}');
    await _showFromRemoteMessage(message);
  }

  /// Call this from the top-level background handler in main.dart.
  /// Handles FCM messages when app is in BACKGROUND or TERMINATED.
  static Future<void> handleBackgroundMessage(RemoteMessage message) async {
    debugPrint('[FCM Background] ${message.notification?.title}: ${message.notification?.body}');
    // On Android, FCM auto-displays notification in background — but we want
    // custom channel 'bus_events' with high importance, so we show manually.
    // On iOS, we must show it manually.
    await _showFromRemoteMessage(message);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  static Future<void> _showFromRemoteMessage(RemoteMessage message) async {
    final type = message.data['type'] ?? '';
    final title = message.notification?.title ?? 'Bus Update';
    final body = message.notification?.body ?? '';

    // Use body content hash for unique ID so different stops don't overwrite
    int id = '${type}_$body'.hashCode.abs() % 100000;

    await _show(id: id, title: title, body: body);
  }

  static Future<void> _show({
    required int id,
    required String title,
    required String body,
    String? payload,
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
      playSound: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );

    await _plugin.show(id, title, body, details, payload: payload);
  }
}
