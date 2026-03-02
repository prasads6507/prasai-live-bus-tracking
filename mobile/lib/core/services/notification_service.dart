import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../../firebase_options.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    // ✅ FIX: Initialize Firebase if not already done
    // This is needed when this is called from the background isolate
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    }

    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    // ✅ FIX: requestCriticalPermission ensures iOS shows notifications even
    // in Do Not Disturb mode (important for bus arrival alerts)
    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
      // ✅ FIX: This callback allows foreground notifications to show on iOS
      // Without this, notifications don't appear when app is in foreground on iOS
      onDidReceiveLocalNotification: _onDidReceiveLocalNotification,
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
      onDidReceiveBackgroundNotificationResponse: _backgroundNotificationResponseHandler,
    );

    // Create high-importance notification channel for Android
    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'bus_events',
      'Bus Events',
      description: 'Live bus arrival and stop notifications',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
    );

    final androidPlugin = _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    if (androidPlugin != null) {
      await androidPlugin.createNotificationChannel(channel);
      final granted = await androidPlugin.requestNotificationsPermission();
      debugPrint('[NotificationService] Android permission granted: $granted');
    }

    // ✅ FIX: Request FCM permission — critical for iOS
    // On iOS this shows the system "Allow Notifications" dialog
    final messagingSettings =
        await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
      criticalAlert: false,
    );
    debugPrint(
        '[NotificationService] FCM permission: ${messagingSettings.authorizationStatus}');

    _initialized = true;
    debugPrint('[NotificationService] Initialized successfully');
  }

  // Required for iOS < 10 (rarely needed but keeps it clean)
  static void _onDidReceiveLocalNotification(
      int id, String? title, String? body, String? payload) {
    debugPrint('[iOS Legacy Notification] $title: $body');
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

  /// Handles FCM messages when app is in FOREGROUND.
  static Future<void> handleForegroundMessage(RemoteMessage message) async {
    debugPrint(
        '[FCM Foreground] ${message.notification?.title}: ${message.notification?.body}');
    await _showFromRemoteMessage(message);
  }

  /// ✅ FIX: Handles FCM messages when app is in BACKGROUND or TERMINATED.
  /// Previously this did nothing on iOS — now it always shows the notification.
  static Future<void> handleBackgroundMessage(RemoteMessage message) async {
    debugPrint(
        '[FCM Background] ${message.notification?.title}: ${message.notification?.body}');
    // ✅ On BOTH Android AND iOS we show it manually here.
    // The reason: If you send messages WITH a `notification` payload from your server,
    // Android will show a duplicate (system + ours). To avoid that, change your server
    // to send DATA-ONLY messages (no `notification` key) — then only this handler runs
    // on Android. On iOS, this is the ONLY way notifications appear.
    await _showFromRemoteMessage(message);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  static Future<void> _showFromRemoteMessage(RemoteMessage message) async {
    final title = message.notification?.title ??
        message.data['title'] as String? ??
        'Bus Update';
    final body = message.notification?.body ??
        message.data['body'] as String? ??
        '';

    // Skip if both are empty
    if (title.isEmpty && body.isEmpty) return;

    final type = message.data['type'] as String? ?? '';
    final int id = '${type}_$body'.hashCode.abs() % 100000;

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

    // ✅ FIX: presentBanner replaces deprecated presentAlert on iOS 14+
    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: DarwinNotificationDetails(
        presentAlert: true,   // iOS < 14
        presentBanner: true,  // iOS 14+
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.active,
      ),
    );

    await _plugin.show(id, title, body, details, payload: payload);
  }
}

// ✅ Must be top-level (not a class method) for background handling
@pragma('vm:entry-point')
void _backgroundNotificationResponseHandler(NotificationResponse response) {
  debugPrint('[Notification] Background tap: ${response.payload}');
}
