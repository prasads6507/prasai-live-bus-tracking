import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class AssignedBusCard extends StatelessWidget {
  final String busNumber;
  final String licensePlate;
  final String routeName;

  const AssignedBusCard({
    super.key,
    required this.busNumber,
    required this.licensePlate,
    required this.routeName,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderSubtle),
        boxShadow: [AppShadows.cardShadow],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SELECTED VEHICLE',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textTertiary,
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(busNumber, style: AppTypography.h1),
                const SizedBox(height: 4),
                Text(routeName, style: AppTypography.bodyMd.copyWith(color: AppColors.textSecondary)),
              ],
            ),
          ),
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.bus_alert_rounded, color: AppColors.primary, size: 26),
          ),
        ],
      ),
    );
  }
}
