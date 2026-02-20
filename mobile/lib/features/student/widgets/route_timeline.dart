import 'package:flutter/material.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/glass_card.dart';

class RouteTimeline extends StatefulWidget {
  final List<String> stops;
  final int currentStopIndex;

  const RouteTimeline({
    super.key,
    required this.stops,
    required this.currentStopIndex,
  });

  @override
  State<RouteTimeline> createState() => _RouteTimelineState();
}

class _RouteTimelineState extends State<RouteTimeline> {
  bool _isExpanded = true;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Bus Drop-off', style: AppTypography.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    '${widget.stops.length} Total Drops • ${widget.stops.length - widget.currentStopIndex} Remaining',
                    style: AppTypography.textTheme.labelSmall,
                  ),
                ],
              ),
              IconButton(
                icon: Icon(_isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down),
                onPressed: () => setState(() => _isExpanded = !_isExpanded),
              ),
            ],
          ),
          if (_isExpanded) ...[
            const SizedBox(height: 16),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: widget.stops.length,
              itemBuilder: (context, index) {
                final isCompleted = index < widget.currentStopIndex;
                final isCurrent = index == widget.currentStopIndex;
                
                return _TimelineItem(
                  stopName: widget.stops[index],
                  isCompleted: isCompleted,
                  isCurrent: isCurrent,
                  isLast: index == widget.stops.length - 1,
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final String stopName;
  final bool isCompleted;
  final bool isCurrent;
  final bool isLast;

  const _TimelineItem({
    required this.stopName,
    required this.isCompleted,
    required this.isCurrent,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    Color color = isCompleted ? AppColors.success : (isCurrent ? AppColors.primary : AppColors.textSecondary.withOpacity(0.5));
    
    return IntrinsicHeight(
      child: Row(
        children: [
          Column(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  border: isCurrent ? Border.all(color: Colors.white, width: 2) : null,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: AppColors.surfaceElevated,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24.0),
              child: Text(
                stopName,
                style: AppTypography.textTheme.bodyMedium?.copyWith(
                  color: isCompleted || isCurrent ? AppColors.textPrimary : AppColors.textSecondary,
                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
