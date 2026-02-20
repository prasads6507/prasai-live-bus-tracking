import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../data/providers.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/glass_card.dart';
import '../../../../core/widgets/status_chip.dart';

class BusSearchResultTile extends ConsumerStatefulWidget {
  final String busNumber;
  final String routeName;
  final String plateNumber;
  final BusStatus status;
  final String busId;
  final bool initialIsFavorite;
  final VoidCallback onTap;

  const BusSearchResultTile({
    super.key,
    required this.busNumber,
    required this.routeName,
    required this.plateNumber,
    required this.status,
    required this.busId,
    this.initialIsFavorite = false,
    required this.onTap,
  });

  @override
  ConsumerState<BusSearchResultTile> createState() => _BusSearchResultTileState();
}

class _BusSearchResultTileState extends ConsumerState<BusSearchResultTile> {
  late bool _isFavorite;

  @override
  void initState() {
    super.initState();
    _isFavorite = widget.initialIsFavorite;
  }
  
  @override
  void didUpdateWidget(covariant BusSearchResultTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialIsFavorite != widget.initialIsFavorite) {
      _isFavorite = widget.initialIsFavorite;
    }
  }

  Future<void> _toggleFavorite() async {
    final authState = ref.read(authStateProvider);
    final user = authState.value;
    if (user == null) return;

    final newStatus = !_isFavorite;
    setState(() => _isFavorite = newStatus);

    try {
      await ref.read(firestoreDataSourceProvider).toggleFavoriteBus(
        user.uid,
        widget.busId,
        newStatus,
      );
      // We don't necessarily need to refresh here if we are watching the profile
    } catch (e) {
      if (mounted) {
        setState(() => _isFavorite = !newStatus); // Rollback
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Error updating favorites: $e"))
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        onTap: widget.onTap,
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.directions_bus, color: AppColors.primary),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Text(
                    widget.busNumber,
                    style: AppTypography.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.plateNumber.toUpperCase(),
                    style: AppTypography.textTheme.labelSmall?.copyWith(
                      color: AppColors.textSecondary,
                      letterSpacing: 1.0,
                    ),
                  ),
                ],
              ),
            ),
            
            // Favorite Button
            IconButton(
              icon: Icon(
                _isFavorite ? Icons.favorite : Icons.favorite_border,
                color: _isFavorite ? AppColors.error : AppColors.textSecondary,
              ),
              onPressed: _toggleFavorite,
            ),
            
            const SizedBox(width: 8),
            
            StatusChip(status: widget.status),
          ],
        ),
      ),
    );
  }
}
