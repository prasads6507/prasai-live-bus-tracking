import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class DropOffItem {
  final String time;
  final String location;
  final bool isCompleted;
  final bool isNext;

  const DropOffItem({
    required this.time,
    required this.location,
    this.isCompleted = false,
    this.isNext = false,
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
    
    // Filter to show all pending stops
    final nextStops = items.where((i) => !i.isCompleted).toList();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.primary, // Keep primary color (Light Purple now)
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
              // Progress Circle (Optional)
              CircularProgressIndicator(
                value: total > 0 ? completed / total : 0,
                backgroundColor: Colors.white24,
                color: Colors.white,
                strokeWidth: 4,
              ),
            ],
          ),
          
          if (nextStops.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Divider(color: Colors.white24, height: 1),
            const SizedBox(height: 16),
            ...nextStops.map((stop) => Padding(
              padding: const EdgeInsets.only(bottom: 12.0),
              child: Row(
                children: [
                  Icon(
                    stop.isNext ? Icons.radio_button_checked : Icons.radio_button_unchecked, 
                    color: stop.isNext ? Colors.white : Colors.white60, 
                    size: 16
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      stop.location,
                      style: TextStyle(
                        color: stop.isNext ? Colors.white : Colors.white70,
                        fontWeight: stop.isNext ? FontWeight.bold : FontWeight.w500,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    stop.time,
                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                  )
                ],
              ),
            )),
          ] else
            const Padding(
              padding: EdgeInsets.only(top: 16),
              child: Text("Route Completed", style: TextStyle(color: Colors.white)),
            )
        ],
      ),
    );
  }
}

