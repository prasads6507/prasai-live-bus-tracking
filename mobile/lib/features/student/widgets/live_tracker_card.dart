import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/pulsing_dot.dart';

class LiveTrackerCard extends StatelessWidget {
  final VoidCallback onTap;
  final String busNumber;
  final String licensePlate;
  final String currentStatus;
  final bool isLive;

  const LiveTrackerCard({
    super.key,
    required this.onTap,
    required this.busNumber,
    required this.licensePlate,
    required this.currentStatus,
    this.isLive = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.bgCard, AppColors.bgSurface],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isLive ? AppColors.live.withOpacity(0.4) : AppColors.borderSubtle,
          ),
          boxShadow: isLive ? [AppShadows.liveGlow] : [AppShadows.cardShadow],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    // Bus icon in tinted circle
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: isLive
                            ? AppColors.live.withOpacity(0.15)
                            : AppColors.primarySoft,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.directions_bus_rounded,
                        color: isLive ? AppColors.live : AppColors.primary,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Bus $busNumber", style: AppTypography.h3),
                        Text(
                          "Plate: $licensePlate",
                          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ),
                // Status chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isLive
                        ? AppColors.live.withOpacity(0.15)
                        : AppColors.offline.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(
                      color: isLive
                          ? AppColors.live.withOpacity(0.4)
                          : AppColors.offline.withOpacity(0.4),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isLive)
                        const PulsingDot(color: AppColors.live, size: 6)
                      else
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.offline,
                          ),
                        ),
                      const SizedBox(width: 5),
                      Text(
                        isLive ? "LIVE" : "OFFLINE",
                        style: AppTypography.caption.copyWith(
                          color: isLive ? AppColors.live : AppColors.offline,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Divider(color: AppColors.borderSubtle, height: 1),
            const SizedBox(height: 12),
            // Footer: Status + Track button
            Row(
              children: [
                if (isLive) ...[
                  const PulsingDot(color: AppColors.live, size: 6),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    currentStatus,
                    style: AppTypography.bodyMd.copyWith(
                      color: AppColors.textSecondary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(100),
                    boxShadow: [AppShadows.primaryGlow],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        "Track Live",
                        style: AppTypography.label.copyWith(color: AppColors.textInverse),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.textInverse),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
