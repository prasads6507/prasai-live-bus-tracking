import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class DropOffItem {
  final String time;
  final String location;
  final bool isCompleted;
  final bool isNext;
  final bool isCurrent;
  final double? distanceM;

  const DropOffItem({
    required this.time,
    required this.location,
    this.isCompleted = false,
    this.isNext = false,
    this.isCurrent = false,
    this.distanceM,
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
              bool isArriving = stop.time == "Arriving";

              bool isSkipped = stop.time == "SKIPPED";

              if (stop.isCompleted) {
                iconData = Icons.check_circle;
                iconColor = Colors.white54;
                textColor = Colors.white54;
              } else if (isSkipped) {
                iconData = Icons.error_outline;
                iconColor = Colors.redAccent;
                textColor = Colors.white70;
                fontWeight = FontWeight.normal;
              } else if (isArriving) {
                iconData = Icons.location_on;
                iconColor = Colors.orangeAccent;
                textColor = Colors.white;
                fontWeight = FontWeight.bold;
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
                child: Column(
                  children: [
                    Row(
                      children: [
                        Icon(iconData, color: iconColor, size: 18),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            stop.location,
                            style: TextStyle(
                              color: textColor,
                              fontWeight: fontWeight,
                              decoration: isSkipped ? TextDecoration.lineThrough : null,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: isArriving 
                              ? Colors.orangeAccent.withOpacity(0.2) 
                              : isSkipped 
                                ? Colors.redAccent.withOpacity(0.2)
                                : (stop.isCurrent && !stop.isCompleted) 
                                  ? AppColors.success.withOpacity(0.2) 
                                  : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            border: isArriving || isSkipped || (stop.isCurrent && !stop.isCompleted)
                              ? Border.all(color: (isArriving ? Colors.orangeAccent : isSkipped ? Colors.redAccent : AppColors.success).withOpacity(0.5))
                              : null,
                          ),
                          child: Text(
                            stop.time,
                            style: const TextStyle(
                              color: Colors.black, 
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        )
                      ],
                    ),
                    if (isArriving && stop.distanceM != null) ...[
                      const SizedBox(height: 8),
                      Padding(
                        padding: const EdgeInsets.only(left: 30),
                        child: Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(2),
                                child: LinearProgressIndicator(
                                  value: 1.0 - (stop.distanceM! / 804.0).clamp(0.0, 1.0),
                                  backgroundColor: Colors.white10,
                                  color: Colors.orangeAccent,
                                  minHeight: 4,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              "${(stop.distanceM! / 1609.34).toStringAsFixed(1)} mi",
                              style: const TextStyle(color: Colors.orangeAccent, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ],
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
