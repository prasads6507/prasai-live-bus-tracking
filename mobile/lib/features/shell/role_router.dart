import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/controllers/auth_controller.dart';
import '../../data/models/user_profile.dart';
import 'package:firebase_auth/firebase_auth.dart';

// Placeholder for now, will implement actual logic with GoRouter
class RoleRouter extends ConsumerWidget {
  final Widget child;

  const RoleRouter({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // This widget wraps the main shell and can handle redirection
    // or we use GoRouter's redirect.
    // For now, it just returns the child.
    return child;
  }
}

// Logic for redirection
String? roleRedirect(
  BuildContext context,
  GoRouterState state,
  AsyncValue<User?> authState,
  AsyncValue<UserProfile?> profileState,
  Map<String, dynamic>? selectedCollege,
) {
  final isLoggedIn = authState.value != null;
  final isLoggingIn = state.uri.path == '/login';
  final isSelectingCollege = state.uri.path == '/college-selection';

  if (!isLoggedIn) {
    // If no college selected, ALWAYS go to selection
    if (selectedCollege == null) {
      if (!isSelectingCollege) return '/college-selection';
      return null;
    }
    
    // College is selected, but not logged in.
    // If we are on selection page, but already have a college, stay there unless they manually clicked change?
    // Actually, if selectedCollege exists, the initial destination should be login.
    if (!isLoggingIn && !isSelectingCollege) {
      return '/login';
    }
    return null;
  }

  // If logged in but on login/selection page, redirect to dashboard
  if (isLoggingIn || isSelectingCollege) {
    return profileState.when(
      data: (profile) {
        if (profile == null) return null; // Should ideally handle error or retry
        
        // Multi-tenant role-based routing
        switch (profile.role.toUpperCase()) {
          case 'STUDENT':
            return '/student';
          case 'DRIVER':
            return '/driver';
          case 'ADMIN':
          case 'COLLEGE_ADMIN':
          case 'SUPER_ADMIN':
          case 'OWNER':
            return '/admin';
          default:
            return '/student';
        }
      },
      loading: () => null, // Stay on login while loading profile
      error: (_, __) => null,
    );
  }

  return null;
}
