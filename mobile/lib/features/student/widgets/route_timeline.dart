import 'package:flutter/material.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/glass_card.dart';

class RouteTimeline extends StatefulWidget {
  final List<String> stops;
  final int currentStopIndex;
  final List<String>? etaLabels;         // e.g. ["✅ Done", "~3 min", "TBD"]
  final List<String>? plannedTimes;      // e.g. ["07:30", "07:45", "08:00"]

  const RouteTimeline({
    super.key,
    required this.stops,
    required this.currentStopIndex,
    this.etaLabels,
    this.plannedTimes,
  });

  @override
  State<RouteTimeline> createState() => _RouteTimelineState();
}

class _RouteTimelineState extends State<RouteTimeline>
    with SingleTickerProviderStateMixin {
  bool _isExpanded = true;
  late AnimationController _blinkController;
  late Animation<double> _blinkAnimation;

  @override
  void initState() {
    super.initState();
    _blinkController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
    _blinkAnimation = Tween<double>(begin: 0.3, end: 1.0).animate(
      CurvedAnimation(parent: _blinkController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _blinkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.stops.length - widget.currentStopIndex;
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
                  Text('Route Stops', style: AppTypography.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    '${widget.stops.length} Stops • $remaining Remaining',
                    style: AppTypography.textTheme.labelSmall,
                  ),
                ],
              ),
              IconButton(
                icon: Icon(_isExpanded
                    ? Icons.keyboard_arrow_up
                    : Icons.keyboard_arrow_down),
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
                final etaLabel = (widget.etaLabels != null && index < widget.etaLabels!.length)
                    ? widget.etaLabels![index]
                    : null;
                final planned = (widget.plannedTimes != null && index < widget.plannedTimes!.length)
                    ? widget.plannedTimes![index]
                    : null;

                return _TimelineItem(
                  stopName: widget.stops[index],
                  isCompleted: isCompleted,
                  isCurrent: isCurrent,
                  isLast: index == widget.stops.length - 1,
                  etaLabel: etaLabel,
                  plannedTime: planned,
                  blinkAnimation: isCurrent ? _blinkAnimation : null,
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
  final String? etaLabel;
  final String? plannedTime;
  final Animation<double>? blinkAnimation;

  const _TimelineItem({
    required this.stopName,
    required this.isCompleted,
    required this.isCurrent,
    required this.isLast,
    this.etaLabel,
    this.plannedTime,
    this.blinkAnimation,
  });

  @override
  Widget build(BuildContext context) {
    final baseColor = isCompleted
        ? AppColors.success
        : (isCurrent ? AppColors.primary : AppColors.textSecondary.withOpacity(0.3));

    Widget dotWidget = Container(
      width: isCurrent ? 16 : 12,
      height: isCurrent ? 16 : 12,
      decoration: BoxDecoration(
        color: baseColor,
        shape: BoxShape.circle,
        border: isCurrent ? Border.all(color: Colors.white, width: 2) : null,
        boxShadow: isCurrent
            ? [BoxShadow(color: AppColors.primary.withOpacity(0.5), blurRadius: 8)]
            : null,
      ),
      child: isCompleted
          ? const Icon(Icons.check, size: 8, color: Colors.white)
          : null,
    );

    // Wrap current stop dot in blink animation
    if (isCurrent && blinkAnimation != null) {
      dotWidget = AnimatedBuilder(
        animation: blinkAnimation!,
        builder: (context, child) => Opacity(
          opacity: blinkAnimation!.value,
          child: child,
        ),
        child: dotWidget,
      );
    }

    return IntrinsicHeight(
      child: Row(
        children: [
          SizedBox(
            width: 20,
            child: Column(
              children: [
                dotWidget,
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            isCompleted ? AppColors.success : baseColor,
                            (isCompleted || isCurrent) ? AppColors.success.withOpacity(0.3) : AppColors.textSecondary.withOpacity(0.15),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stopName,
                          style: AppTypography.textTheme.bodyMedium?.copyWith(
                            color: isCompleted || isCurrent
                                ? AppColors.textPrimary
                                : AppColors.textSecondary,
                            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        if (plannedTime != null && plannedTime!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              'Planned: $plannedTime',
                              style: AppTypography.textTheme.labelSmall?.copyWith(
                                color: AppColors.textSecondary.withOpacity(0.6),
                                fontSize: 10,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (etaLabel != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isCompleted
                            ? AppColors.success.withOpacity(0.15)
                            : (isCurrent
                                ? AppColors.primary.withOpacity(0.15)
                                : AppColors.surfaceElevated),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        etaLabel!,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isCompleted
                              ? AppColors.success
                              : (isCurrent ? AppColors.primary : AppColors.textSecondary),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
