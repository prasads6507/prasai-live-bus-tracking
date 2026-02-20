import 'package:flutter/material.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/glass_card.dart';

class BusMiniMapCard extends StatelessWidget {
  final String busNumber;
  final String licensePlate;
  final String currentStreet;
  final double speed;
  final VoidCallback onTap;

  const BusMiniMapCard({
    super.key,
    required this.busNumber,
    required this.licensePlate,
    required this.currentStreet,
    required this.speed,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Map Placeholder
          Container(
            height: 150,
            color: AppColors.surfaceElevated,
            child: Center(
              child: Icon(Icons.map, color: AppColors.textSecondary.withOpacity(0.5), size: 48),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'License plate',
                      style: AppTypography.textTheme.labelSmall,
                    ),
                    Text(
                      licensePlate,
                      style: AppTypography.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppColors.black,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_outward, color: Colors.white, size: 20),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
