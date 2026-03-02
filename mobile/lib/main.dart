import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/theme/app_theme.dart';
import 'firebase_options.dart';
import 'features/shell/app_router.dart';
import 'core/services/location_service.dart';
import 'data/providers.dart';
import 'features/driver/services/background_tracking_service.dart';
import 'core/services/notification_service.dart';
import 'features/auth/controllers/auth_controller.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIX: Background FCM handler — now handles BOTH Android AND iOS correctly.
//
// BEFORE (broken for iOS):
//   if (message.notification == null) { ... }
//   // If notification != null, assumes "Android already displayed it" — WRONG ON iOS!
//
// AFTER (correct for both platforms):
//   Always initialize + show the notification.
//   On Android: FCM already auto-shows it, so we get a duplicate.
//     Fix: send DATA-ONLY messages from your server (no 'notification' key),
//     so BOTH platforms go through this handler. See server-side note below.
//   On iOS: This is the ONLY way to show notifications in background/terminated.
// ─────────────────────────────────────────────────────────────────────────────
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // CRITICAL: Firebase MUST be initialized here — this runs in an isolated
  // Dart context (separate from the main app isolate).
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  }

  // Initialize local notifications plugin in this isolated context
  await NotificationService.initialize();

  // Show the notification — works on BOTH iOS and Android
  await NotificationService.handleBackgroundMessage(message);
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // Register the background handler IMMEDIATELY after Firebase.initializeApp
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Initialize Background Tracking Service (Android foreground service + iOS GPS)
    await BackgroundTrackingService.initialize();

    // Initialize Local Notifications
    await NotificationService.initialize();
  } catch (e) {
    debugPrint("Initialization error: $e");
  }

  // Restore session synchronously before app starts
  final prefs = await SharedPreferences.getInstance();
  final colId = prefs.getString('selected_college_id');
  final colSlug = prefs.getString('college_slug');
  final colName = prefs.getString('college_name');

  String? initCollegeId;
  Map<String, dynamic>? initCollegeData;

  if (colId != null && colSlug != null && colName != null) {
    initCollegeId = colId;
    initCollegeData = {
      'collegeId': colId,
      'slug': colSlug,
      'collegeName': colName,
    };
  }

  runApp(ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      selectedCollegeIdProvider.overrideWith((ref) => initCollegeId),
      selectedCollegeProvider.overrideWith((ref) => initCollegeData),
    ],
    child: const MyApp(),
  ));
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkLocation();
      _setupFcmListeners();
      _registerTokenIfLoggedIn();
    });
  }

  void _registerTokenIfLoggedIn() async {
    final user = FirebaseAuth.instance.currentUser;
    final collegeId = ref.read(selectedCollegeIdProvider);
    if (user != null && collegeId != null) {
      debugPrint('[FCM] Session restored, ensuring token is registered...');

      try {
        var userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();
        String role = 'student';

        if (userDoc.exists) {
          role = userDoc.data()?['role'] ?? 'user';
        } else {
          userDoc = await FirebaseFirestore.instance
              .collection('students')
              .doc(user.uid)
              .get();
          if (userDoc.exists) {
            role = 'student';
          }
        }

        ref
            .read(authControllerProvider.notifier)
            .registerFcmTokenForSession(user.uid, collegeId, role);
      } catch (e) {
        debugPrint('[FCM] Error fetching role: $e');
        ref
            .read(authControllerProvider.notifier)
            .registerFcmTokenForSession(user.uid, collegeId, 'student');
      }
    }
  }

  void _setupFcmListeners() async {
    // 1. App was KILLED and launched via notification tap
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage, 'KILLED');
    }

    // ✅ FIX: iOS MUST have this set to show notifications when app is FOREGROUND
    // Without this, iOS silently drops all FCM notifications when app is open!
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // FOREGROUND: App is open and visible — show via local notifications
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      NotificationService.handleForegroundMessage(message);
    });

    // App was in BACKGROUND and user tapped the notification
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _handleNotificationTap(message, 'BACKGROUND');
    });
  }

  void _handleNotificationTap(RemoteMessage message, String source) {
    debugPrint('[FCM] Notification tapped from $source: ${message.data}');

    final busId = message.data['busId'];
    if (busId != null && busId.toString().isNotEmpty) {
      final router = ref.read(routerProvider);
      router.push('/student/track', extra: busId);
    }
  }

  Future<void> _checkLocation() async {
    await LocationService.ensureLocationPermission(context);
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'PRASAI',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
