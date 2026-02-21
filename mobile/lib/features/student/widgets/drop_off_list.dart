import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class DropOffItem {
  final String time;
  final String location;
  final bool isCompleted;
  final bool isNext;
  final bool isCurrent;

  const DropOffItem({
    required this.time,
    required this.location,
    this.isCompleted = false,
    this.isNext = false,
    this.isCurrent = false,
  });
}

class DropOffList extends StatelessWidget {
  final List<DropOffItem> items;

  const DropOffList({
    super.key,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    // Calculate stats
    final total = items.length;
    final completed = items.where((i) => i.isCompleted).length;
    final remaining = total - completed;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Bus Drop-off",
                style: AppTypography.textTheme.labelMedium?.copyWith(
                  color: Colors.white.withOpacity(0.8),
                ),
              ),
              const Icon(Icons.location_on_rounded, color: Colors.white, size: 20),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "$total Total Stops",
                    style: AppTypography.textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    "$remaining Remaining",
                    style: AppTypography.textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withOpacity(0.8),
                    ),
                  ),
                ],
              ),
              // Progress Circle
              CircularProgressIndicator(
                value: total > 0 ? completed / total : 0,
                backgroundColor: Colors.white24,
                color: Colors.white,
                strokeWidth: 4,
              ),
            ],
          ),
          
          if (items.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Divider(color: Colors.white24, height: 1),
            const SizedBox(height: 16),
            ...items.map((stop) {
              Color iconColor;
              IconData iconData;
              FontWeight fontWeight = FontWeight.w500;
              Color textColor = Colors.white70;

              if (stop.isCompleted) {
                iconData = Icons.check_circle;
                iconColor = Colors.white54;
                textColor = Colors.white54;
              } else if (stop.isCurrent) {
                iconData = Icons.location_on;
                iconColor = AppColors.success;
                textColor = Colors.white;
                fontWeight = FontWeight.bold;
              } else if (stop.isNext) {
                iconData = Icons.radio_button_checked;
                iconColor = Colors.white;
                textColor = Colors.white;
                fontWeight = FontWeight.bold;
              } else {
                iconData = Icons.radio_button_unchecked;
                iconColor = Colors.white60;
              }

              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: Row(
                  children: [
                    Icon(iconData, color: iconColor, size: 18),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        stop.location,
                        style: TextStyle(
                          color: textColor,
                          fontWeight: fontWeight,
                          decoration: stop.isCompleted ? TextDecoration.lineThrough : null,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      stop.time,
                      style: TextStyle(
                        color: stop.isCurrent ? AppColors.success : (stop.isNext ? Colors.white : Colors.white54), 
                        fontSize: stop.isCurrent || stop.isNext ? 14 : 12,
                        fontWeight: stop.isCurrent ? FontWeight.bold : FontWeight.normal,
                      ),
                    )
                  ],
                ),
              );
            }),
          ] else
            const Padding(
              padding: EdgeInsets.only(top: 16),
              child: Text("Route info unavailable", style: TextStyle(color: Colors.white)),
            )
        ],
      ),
    );
  }
}
