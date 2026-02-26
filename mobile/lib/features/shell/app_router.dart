import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/providers.dart';
import '../auth/screens/college_selection_screen.dart';
import '../auth/screens/login_screen.dart';
import '../auth/controllers/auth_controller.dart';
import '../student/screens/student_home.dart';
import '../student/screens/student_track_screen.dart';
import '../student/screens/student_search_screen.dart';
import '../student/screens/student_profile_screen.dart';
import '../student/screens/student_buses_screen.dart';
import '../driver/screens/driver_home.dart';
import '../driver/screens/driver_profile_screen.dart';
import '../driver/screens/driver_students_screen.dart';
import '../admin/screens/admin_dashboard.dart';
import '../onboarding/screens/onboarding_screen.dart';
import 'role_router.dart';
import 'student_shell.dart';
import 'driver_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // We use a ValueNotifier to notify GoRouter when to refresh
  final listenable = ValueNotifier<void>(null);

  // Listen to provider changes and notify the router to re-evaluate redirects
  ref.listen<AsyncValue<dynamic>>(authStateProvider, (_, __) => listenable.notifyListeners());
  ref.listen<Map<String, dynamic>?>(selectedCollegeProvider, (_, __) => listenable.notifyListeners());
  ref.listen<AsyncValue<dynamic>>(userProfileProvider, (_, __) => listenable.notifyListeners());

  return GoRouter(
    initialLocation: ref.read(sharedPreferencesProvider).getBool('has_seen_onboarding') == true ? '/college-selection' : '/onboarding',
    refreshListenable: listenable,
    redirect: (context, state) {
      // Use ref.read to get the current state without creating a dependency 
      // that forces the *RouteProvider* itself to rebuild.
      final authState = ref.read(authStateProvider);
      final profileState = ref.read(userProfileProvider);
      final selectedCollege = ref.read(selectedCollegeProvider);
      final prefs = ref.read(sharedPreferencesProvider);
      final hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;

      return roleRedirect(
        context,
        state,
        authState,
        profileState,
        selectedCollege,
        hasSeenOnboarding,
      );
    },
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/college-selection',
        builder: (context, state) => const CollegeSelectionScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) {
          final collegeFromExtra = state.extra as Map<String, dynamic>?;
          // IMPORTANT: ref.read here might be stale if we don't rely on the router rebuild?
          // Actually, state.extra comes from navigation.
          // Fallback to provider if extra is null
          final selectedCollege = ref.read(selectedCollegeProvider);
          final college = collegeFromExtra ?? selectedCollege;
          
          if (college == null) {
            return const CollegeSelectionScreen();
          }
          return LoginScreen(college: college);
        },
      ),
      // Student Shell
      ShellRoute(
        builder: (context, state, child) => StudentShell(child: child),
        routes: [
          GoRoute(
            path: '/student',
            builder: (context, state) => const StudentHomeScreen(),
          ),
          GoRoute(
            path: '/student/track',
            builder: (context, state) => StudentTrackScreen(busId: state.extra as String?),
          ),
          GoRoute(
            path: '/student/search',
            builder: (context, state) => const StudentSearchScreen(),
          ),
          GoRoute(
            path: '/student/buses',
            builder: (context, state) => const StudentBusesScreen(),
          ),
          GoRoute(
            path: '/student/profile',
            builder: (context, state) => const StudentProfileScreen(),
          ),
        ],
      ),
      // Driver Shell
      ShellRoute(
        builder: (context, state, child) => DriverShell(child: child),
        routes: [
          GoRoute(
            path: '/driver',
            builder: (context, state) => const DriverHomeScreen(),
          ),
          GoRoute(
            path: '/driver/students',
            builder: (context, state) => const DriverStudentsScreen(),
          ),
          GoRoute(
            path: '/driver/profile',
            builder: (context, state) => const DriverProfileScreen(),
          ),
        ],
      ),
      // Admin (No shell for now)
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminDashboardScreen(),
      ),
    ],
  );
});
