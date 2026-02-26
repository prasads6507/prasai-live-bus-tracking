import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/colors.dart';

/// A skeleton shimmer placeholder card matching the shape of bus cards.
/// Displays while data is loading.
class ShimmerCard extends StatelessWidget {
  final double height;
  final double borderRadius;

  const ShimmerCard({
    super.key,
    this.height = 140,
    this.borderRadius = 20,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.bgCard,
      highlightColor: AppColors.bgSurface,
      child: Container(
        height: height,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: AppColors.borderSubtle),
        ),
      ),
    );
  }
}

/// A list of shimmer cards useful for loading states.
class ShimmerCardList extends StatelessWidget {
  final int count;
  final double cardHeight;

  const ShimmerCardList({
    super.key,
    this.count = 3,
    this.cardHeight = 140,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        count,
        (_) => ShimmerCard(height: cardHeight),
      ),
    );
  }
}
