import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/colors.dart';
import '../../core/widgets/app_scaffold.dart';

class DriverShell extends StatelessWidget {
  final Widget child;

  const DriverShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.surfaceElevated, width: 1)),
        ),
        child: BottomNavigationBar(
          backgroundColor: AppColors.surface,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textSecondary,
          type: BottomNavigationBarType.fixed,
          currentIndex: _calculateSelectedIndex(context),
          onTap: (int idx) => _onItemTapped(idx, context),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.directions_bus), label: 'Trip'),
            BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Students'),
            BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
          ],
        ),
      ),
    );
  }

  static int _calculateSelectedIndex(BuildContext context) {
    final String location = GoRouterState.of(context).uri.path;
    if (location.startsWith('/driver/students')) return 1;
    if (location.startsWith('/driver/profile')) return 2;
    return 0; // Trip
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/driver');
        break;
      case 1:
        context.go('/driver/students');
        break;
      case 2:
        context.go('/driver/profile');
        break;
    }
  }
}
