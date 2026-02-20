import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';

enum BusStatus { live, active, offline }

class StatusChip extends StatelessWidget {
  final BusStatus status;

  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    String text;

    switch (status) {
      case BusStatus.live:
        color = AppColors.success;
        text = 'LIVE';
        break;
      case BusStatus.active:
        color = AppColors.warning;
        text = 'ACTIVE';
        break;
      case BusStatus.offline:
        color = AppColors.textSecondary;
        text = 'OFFLINE';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: AppTypography.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
