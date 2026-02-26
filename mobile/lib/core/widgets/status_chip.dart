import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';
import 'pulsing_dot.dart';

class _ChipConfig {
  final Color color;
  final String label;
  const _ChipConfig({required this.color, required this.label});
}

// Keep old enum for backward compatibility
enum BusStatus { live, active, offline }

class StatusChip extends StatelessWidget {
  final String? statusString;
  final BusStatus? status;

  const StatusChip({super.key, this.statusString, this.status});

  static const Map<String, _ChipConfig> _config = {
    'ON_ROUTE':    _ChipConfig(color: AppColors.live,        label: "LIVE"),
    'ACTIVE':      _ChipConfig(color: AppColors.active,      label: "ACTIVE"),
    'IDLE':        _ChipConfig(color: AppColors.accent,      label: "IDLE"),
    'MAINTENANCE': _ChipConfig(color: AppColors.maintenance, label: "MAINT"),
    'OFFLINE':     _ChipConfig(color: AppColors.offline,     label: "OFFLINE"),
  };

  static const _ChipConfig _defaultConfig = _ChipConfig(color: AppColors.offline, label: "UNKNOWN");

  String _resolveStatus() {
    if (statusString != null) return statusString!.toUpperCase();
    switch (status) {
      case BusStatus.live:
        return 'ON_ROUTE';
      case BusStatus.active:
        return 'ACTIVE';
      case BusStatus.offline:
        return 'OFFLINE';
      default:
        return 'OFFLINE';
    }
  }

  @override
  Widget build(BuildContext context) {
    final resolved = _resolveStatus();
    final config = _config[resolved] ?? _defaultConfig;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: config.color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: config.color.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (resolved == 'ON_ROUTE')
            PulsingDot(color: config.color, size: 6)
          else
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: config.color,
              ),
            ),
          const SizedBox(width: 5),
          Text(
            config.label,
            style: AppTypography.caption.copyWith(
              color: config.color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
