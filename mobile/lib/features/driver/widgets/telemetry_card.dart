import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/pulsing_dot.dart';

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
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isTracking ? null : AppColors.bgCard,
        gradient: isTracking
            ? const LinearGradient(
                colors: [Color(0xFF22C55E), Color(0xFF10B981)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        borderRadius: BorderRadius.circular(24),
        border: isTracking ? null : Border.all(color: AppColors.borderSubtle),
        boxShadow: [
          if (isTracking)
            BoxShadow(
              color: const Color(0xFF10B981).withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10),
            )
          else
            AppShadows.cardShadow,
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Watermark icon
          Positioned(
            right: -20,
            bottom: -20,
            child: Opacity(
              opacity: 0.08,
              child: Transform.rotate(
                angle: 0.2,
                child: Icon(
                  Icons.navigation_rounded,
                  size: 130,
                  color: isTracking ? Colors.white : AppColors.textTertiary,
                ),
              ),
            ),
          ),

          Column(
            children: [
              // Status Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isTracking ? Colors.white.withOpacity(0.2) : AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PulsingDot(
                      color: isTracking ? Colors.white : AppColors.textTertiary,
                      size: 6,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'CURRENT STATUS',
                      style: AppTypography.caption.copyWith(
                        color: isTracking ? Colors.white : AppColors.textTertiary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Status Title
              Text(
                isTracking ? 'ON TRIP' : 'READY FOR TRIP',
                style: AppTypography.h1.copyWith(
                  color: isTracking ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 20),

              // Speedometer
              if (isTracking)
                Column(
                  children: [
                    Text(
                      speed.toStringAsFixed(0),
                      style: AppTypography.display.copyWith(
                        fontSize: 72,
                        color: Colors.white,
                        height: 1.0,
                      ),
                    ),
                    Text(
                      "mph",
                      style: AppTypography.caption.copyWith(
                        color: Colors.white70,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                )
              else
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.navigation_rounded, size: 36, color: AppColors.textTertiary),
                ),

              const SizedBox(height: 24),

              // Metrics strip
              if (isTracking)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      _MetricItem(label: 'LAST UPDATE', value: lastUpdateTime),
                      Container(width: 1, height: 28, color: Colors.white.withOpacity(0.2)),
                      _MetricItem(label: 'LOCATION', value: currentRoad),
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

  const _MetricItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: Colors.white70,
              letterSpacing: 0.5,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTypography.label.copyWith(color: Colors.white),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
