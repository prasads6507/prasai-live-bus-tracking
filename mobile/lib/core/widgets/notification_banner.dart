import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';

enum NotificationType { info, success, warning, error, busNear }

/// An in-app notification banner that slides down from the top.
/// Use [AppNotificationBanner.show] to display.
class AppNotificationBanner extends StatefulWidget {
  final String title;
  final String message;
  final NotificationType type;
  final Duration duration;
  final VoidCallback? onDismiss;

  const AppNotificationBanner({
    super.key,
    required this.title,
    required this.message,
    this.type = NotificationType.info,
    this.duration = const Duration(seconds: 4),
    this.onDismiss,
  });

  /// Shows the banner as an overlay at the top of the screen.
  static void show(
    BuildContext context, {
    required String title,
    required String message,
    NotificationType type = NotificationType.info,
    Duration duration = const Duration(seconds: 4),
  }) {
    final overlay = Overlay.of(context);
    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (ctx) => _BannerOverlay(
        title: title,
        message: message,
        type: type,
        duration: duration,
        onDismiss: () => entry.remove(),
      ),
    );

    overlay.insert(entry);
  }

  @override
  State<AppNotificationBanner> createState() => _AppNotificationBannerState();
}

class _AppNotificationBannerState extends State<AppNotificationBanner> {
  @override
  Widget build(BuildContext context) {
    return _BannerContent(
      title: widget.title,
      message: widget.message,
      type: widget.type,
      onDismiss: widget.onDismiss,
    );
  }
}

class _BannerOverlay extends StatefulWidget {
  final String title;
  final String message;
  final NotificationType type;
  final Duration duration;
  final VoidCallback onDismiss;

  const _BannerOverlay({
    required this.title,
    required this.message,
    required this.type,
    required this.duration,
    required this.onDismiss,
  });

  @override
  State<_BannerOverlay> createState() => _BannerOverlayState();
}

class _BannerOverlayState extends State<_BannerOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    _controller.forward();

    Future.delayed(widget.duration, () {
      if (mounted) {
        _controller.reverse().then((_) => widget.onDismiss());
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.of(context).padding.top + 8,
      left: 12,
      right: 12,
      child: SlideTransition(
        position: _slideAnimation,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: GestureDetector(
            onVerticalDragEnd: (details) {
              if (details.primaryVelocity != null &&
                  details.primaryVelocity! < -100) {
                _controller.reverse().then((_) => widget.onDismiss());
              }
            },
            child: _BannerContent(
              title: widget.title,
              message: widget.message,
              type: widget.type,
              onDismiss: () {
                _controller.reverse().then((_) => widget.onDismiss());
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _BannerContent extends StatelessWidget {
  final String title;
  final String message;
  final NotificationType type;
  final VoidCallback? onDismiss;

  const _BannerContent({
    required this.title,
    required this.message,
    required this.type,
    this.onDismiss,
  });

  Color get _accentColor {
    switch (type) {
      case NotificationType.info:
        return AppColors.active;
      case NotificationType.success:
        return AppColors.success;
      case NotificationType.warning:
        return AppColors.accent;
      case NotificationType.error:
        return AppColors.error;
      case NotificationType.busNear:
        return AppColors.live;
    }
  }

  IconData get _icon {
    switch (type) {
      case NotificationType.info:
        return Icons.info_outline_rounded;
      case NotificationType.success:
        return Icons.check_circle_outline_rounded;
      case NotificationType.warning:
        return Icons.warning_amber_rounded;
      case NotificationType.error:
        return Icons.error_outline_rounded;
      case NotificationType.busNear:
        return Icons.directions_bus_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgCard.withOpacity(0.95),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _accentColor.withOpacity(0.4)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _accentColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_icon, color: _accentColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title,
                      style: AppTypography.h3
                          .copyWith(fontSize: 14, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(message,
                      style: AppTypography.caption
                          .copyWith(color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
