import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/pulsing_dot.dart';

class DriverHeader extends ConsumerWidget {
  final String driverName;
  final bool isOnline;
  final VoidCallback? onLogout;

  const DriverHeader({
    super.key,
    required this.driverName,
    required this.isOnline,
    this.onLogout,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 8, 20, 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.bgBase, AppColors.bgDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          // Branded nav icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [AppShadows.primaryGlow],
            ),
            child: const Icon(Icons.navigation_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          
          // Name + status
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Driver Portal', style: AppTypography.h3),
                Row(
                  children: [
                    PulsingDot(
                      color: isOnline ? AppColors.live : AppColors.offline,
                      size: 6,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      isOnline ? driverName : 'Offline',
                      style: AppTypography.caption.copyWith(
                        color: isOnline ? AppColors.live : AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Logout
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.error.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: IconButton(
              icon: const Icon(Icons.logout_rounded, size: 16, color: AppColors.error),
              onPressed: onLogout,
              padding: EdgeInsets.zero,
            ),
          ),
        ],
      ),
    );
  }
}
