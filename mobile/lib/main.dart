import 'package:cloud_firestore/cloud_firestore.dart';
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
import 'package:firebase_auth/firebase_auth.dart';
import 'core/services/notification_service.dart';
import 'features/auth/controllers/auth_controller.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // On Android, FCM automatically shows notifications that have a
  // `notification` payload when the app is in background/terminated.
  // We only need to manually display data-only messages here.
  // Re-initializing local notifications to show them via our custom channel.
  if (message.notification == null) {
    // Data-only message — show it manually via our local notification
    await NotificationService.initialize();
    await NotificationService.handleBackgroundMessage(message);
  }
  // If message.notification != null, Android already displayed it — do nothing.
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    // Initialize Background Tracking Service for Drivers
    await BackgroundTrackingService.initialize();
    
    // Initialize Local Notifications
    await NotificationService.initialize();
  } catch (e) {
    debugPrint("Firebase initialization or Firestore query failed: $e");
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
        // Fetch role from users collection (drivers/admins)
        var userDoc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
        String role = 'student';
        
        if (userDoc.exists) {
          role = userDoc.data()?['role'] ?? 'user';
        } else {
          // Fallback to students collection
          userDoc = await FirebaseFirestore.instance.collection('students').doc(user.uid).get();
          if (userDoc.exists) {
            role = 'student';
          }
        }
        
        ref.read(authControllerProvider.notifier).registerFcmTokenForSession(user.uid, collegeId, role);
      } catch (e) {
        debugPrint('[FCM] Error fetching role for token registration: $e');
        // Default to student if error, but try to register anyway
        ref.read(authControllerProvider.notifier).registerFcmTokenForSession(user.uid, collegeId, 'student');
      }
    }
  }

  void _setupFcmListeners() async {
    // 1. Initial message (Killed state)
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage, 'KILLED');
    }

    // 2. Foreground presentation for iOS (critical for sound/alert)
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // FOREGROUND: App is open and visible
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      NotificationService.handleForegroundMessage(message);
    });

    // 3. Handle notification TAP when app was in background (not killed)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _handleNotificationTap(message, 'BACKGROUND');
    });
  }

  void _handleNotificationTap(RemoteMessage message, String source) {
    debugPrint('[FCM] Notification tapped from $source: ${message.data}');
    
    final busId = message.data['busId'];

    if (busId != null && busId.toString().isNotEmpty) {
      // Navigate to tracking screen using `extra:` to match the route definition
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
