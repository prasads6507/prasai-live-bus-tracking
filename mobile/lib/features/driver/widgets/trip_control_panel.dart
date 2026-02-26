import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class TripControlPanel extends StatelessWidget {
  final bool isTripActive;
  final VoidCallback onStartTrip;
  final VoidCallback onEndTrip;
  final bool isLoading;

  const TripControlPanel({
    super.key,
    required this.isTripActive,
    required this.onStartTrip,
    required this.onEndTrip,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isTripActive) {
      // End Trip button — white on dark bg, red accent
      return SizedBox(
        width: double.infinity,
        height: 60,
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.bgCard,
            foregroundColor: AppColors.error,
            elevation: 0,
            side: BorderSide(color: AppColors.error.withOpacity(0.4), width: 1.5),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: isLoading ? null : onEndTrip,
          child: isLoading
              ? const SizedBox(
                  height: 24, width: 24,
                  child: CircularProgressIndicator(color: AppColors.error, strokeWidth: 2.5),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.stop_circle_rounded, size: 22),
                    const SizedBox(width: 10),
                    Text('End Trip', style: AppTypography.h3.copyWith(color: AppColors.error)),
                  ],
                ),
        ),
      );
    }

    // Start Trip button — primary with glow
    return SizedBox(
      width: double.infinity,
      height: 60,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textInverse,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          shadowColor: AppColors.primary.withOpacity(0.4),
        ),
        onPressed: isLoading ? null : onStartTrip,
        child: isLoading
            ? const SizedBox(
                height: 24, width: 24,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.navigation_rounded, size: 22),
                  const SizedBox(width: 10),
                  Text('Start Trip', style: AppTypography.h3.copyWith(color: AppColors.textInverse)),
                ],
              ),
      ),
    );
  }
}
