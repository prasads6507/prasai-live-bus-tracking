import 'package:flutter/material.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/primary_button.dart';

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
      return SizedBox(
        width: double.infinity,
        height: 64,
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: AppColors.error,
            elevation: 2,
            shadowColor: Colors.black.withOpacity(0.1),
            side: BorderSide(color: AppColors.error.withOpacity(0.1), width: 1),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          onPressed: isLoading ? null : onEndTrip,
          child: isLoading
              ? const SizedBox(
                  height: 24,
                  width: 24,
                  child: CircularProgressIndicator(color: AppColors.error, strokeWidth: 2.5),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.logout_rounded, size: 22),
                    const SizedBox(width: 10),
                    Text(
                      'End Trip',
                      style: AppTypography.textTheme.titleMedium?.copyWith(
                        color: AppColors.error,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
        ),
      );
    }

    return SizedBox(
      width: double.infinity,
      height: 64,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 8,
          shadowColor: AppColors.primary.withOpacity(0.3),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        onPressed: isLoading ? null : onStartTrip,
        child: isLoading
              ? const SizedBox(
                  height: 24,
                  width: 24,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.navigation_rounded, size: 22),
                    const SizedBox(width: 10),
                    Text(
                      'Start Trip',
                      style: AppTypography.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
      ),
    );
  }
}
