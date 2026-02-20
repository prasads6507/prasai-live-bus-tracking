import 'package:flutter/material.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/glass_card.dart';

class ActionCardRow extends StatelessWidget {
  final VoidCallback onTrackTap;
  final VoidCallback onSearchTap;

  const ActionCardRow({
    super.key,
    required this.onTrackTap,
    required this.onSearchTap,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionCard(
            title: 'Track School Bus',
            icon: Icons.directions_bus,
            color: AppColors.primary,
            onTap: onTrackTap,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _ActionCard(
            title: 'Search Buses',
            icon: Icons.search,
            color: AppColors.surfaceElevated,
            onTap: onSearchTap,
          ),
        ),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color == AppColors.primary ? Colors.white : AppColors.primary),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: AppTypography.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Align(
            alignment: Alignment.centerRight,
            child: Icon(Icons.arrow_forward, size: 16, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
