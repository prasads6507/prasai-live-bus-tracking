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
import 'core/services/notification_service.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // IMPORTANT: In a background isolate, you must re-initialize before using anything
  // Flutter already ensures Firebase is initialized before this is called.
  // We need to initialize local notifications here too.
  await NotificationService.initialize();
  await NotificationService.handleBackgroundMessage(message);
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    // Query Firestore directly to avoid home-network IP dependencies
    // This query is added as per instruction, assuming it's for initial setup/check.
    final snapshot = await FirebaseFirestore.instance
        .collection('colleges')
        .where('status', isEqualTo: 'ACTIVE')
        .get();
    // You might want to do something with 'snapshot' here, e.g., print its size or data.
    print("Firestore query successful. Documents found: ${snapshot.docs.length}");
    
    // Initialize Background Tracking Service for Drivers
    await BackgroundTrackingService.initialize();
    
    // Initialize Local Notifications
    await NotificationService.initialize();
  } catch (e) {
    print("Firebase initialization or Firestore query failed: $e");
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
    });
  }

  void _setupFcmListeners() {
    // FOREGROUND: App is open and visible
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      NotificationService.handleForegroundMessage(message);
    });

    // Handle notification TAP when app was in background (not killed)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[FCM] Notification tapped from background: ${message.data}');
      // Navigation handling could go here
    });
  }

  Future<void> _checkLocation() async {
    await LocationService.ensureLocationPermission(context);
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Transit Hub Bus',
      theme: AppTheme.lightTheme, 
      darkTheme: AppTheme.lightTheme,
      themeMode: ThemeMode.dark,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
