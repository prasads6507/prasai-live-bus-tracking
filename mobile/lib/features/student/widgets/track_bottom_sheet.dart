import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class TrackBottomSheet extends StatelessWidget {
  final String eta;
  final String distance;
  final int stopsRemaining;
  final String totalTime;

  const TrackBottomSheet({
    super.key,
    required this.eta,
    required this.distance,
    required this.stopsRemaining,
    required this.totalTime,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.primary, // Deep Blue/Purple
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.4),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Large ETA
          Text(
            eta, // e.g. "25:11"
            style: AppTypography.textTheme.titleLarge?.copyWith(
              fontSize: 48,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -1,
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Stats Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildStatItem("Drops", "$stopsRemaining"),
              _buildVerticalDivider(),
              _buildStatItem("Total Time", totalTime),
              _buildVerticalDivider(),
              _buildStatItem("Distance", distance),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: AppTypography.textTheme.labelSmall?.copyWith(
            color: Colors.white70,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppTypography.textTheme.titleMedium?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildVerticalDivider() {
    return Container(
      height: 24,
      width: 1,
      color: Colors.white24,
    );
  }
}
