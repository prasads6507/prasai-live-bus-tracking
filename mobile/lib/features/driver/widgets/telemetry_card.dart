import 'package:flutter/material.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/glass_card.dart';

class DriverStatusCard extends StatelessWidget {
  final double speed;
  final bool isTracking;
  final String statusText;
  final String currentRoad;
  final String lastUpdateTime;

  const DriverStatusCard({
    super.key,
    required this.speed,
    required this.isTracking,
    required this.statusText,
    required this.currentRoad,
    required this.lastUpdateTime,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isTracking ? null : AppColors.surface,
        gradient: isTracking 
            ? const LinearGradient(
                colors: [Color(0xFF22C55E), Color(0xFF10B981)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        borderRadius: BorderRadius.circular(32),
        border: isTracking ? null : Border.all(color: AppColors.divider.withOpacity(0.5)),
        boxShadow: [
          if (isTracking)
            BoxShadow(
              color: const Color(0xFF10B981).withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10),
            )
          else
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Background Icon Decoration
          Positioned(
            right: -20,
            bottom: -20,
            child: Opacity(
              opacity: 0.1,
              child: Transform.rotate(
                angle: 0.2,
                child: Icon(
                  Icons.navigation_rounded,
                  size: 140,
                  color: isTracking ? Colors.white : AppColors.textTertiary,
                ),
              ),
            ),
          ),
          
          Column(
            children: [
              // Status Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isTracking ? Colors.white.withOpacity(0.2) : AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isTracking ? Colors.white : AppColors.textTertiary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'CURRENT STATUS',
                      style: AppTypography.textTheme.labelSmall?.copyWith(
                        color: isTracking ? Colors.white : AppColors.textTertiary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              
              // Status Title
              Text(
                isTracking ? 'ON TRIP' : 'READY FOR TRIP',
                style: AppTypography.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: isTracking ? Colors.white : AppColors.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 24),
              
              // Speedometer
              if (isTracking)
                Column(
                  children: [
                    Text(
                      speed.toStringAsFixed(0),
                      style: const TextStyle(
                        fontSize: 80,
                        fontWeight: FontWeight.w900,
                        height: 1.0,
                        color: Colors.white,
                        letterSpacing: -4,
                      ),
                    ),
                    Text(
                      "mph",
                      style: AppTypography.textTheme.labelSmall?.copyWith(
                        color: Colors.white70,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                )
              else
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.background.withOpacity(0.5),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.navigation_rounded, size: 40, color: AppColors.textTertiary),
                  ),
                ),
              
              const SizedBox(height: 32),
              
              // Metrics Grid
              if (isTracking)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      _MetricItem(
                        label: 'LAST UPDATE',
                        value: lastUpdateTime,
                        isDark: false,
                      ),
                      Container(
                        width: 1,
                        height: 32,
                        color: Colors.white.withOpacity(0.2),
                      ),
                      _MetricItem(
                        label: 'LOCATION',
                        value: currentRoad,
                        isDark: false,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricItem extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;

  const _MetricItem({
    required this.label,
    required this.value,
    this.isDark = true,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: Colors.white70,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
