import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class OrgSlugInput extends StatelessWidget {
  final TextEditingController controller;

  const OrgSlugInput({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'College ID (Slug)',
          style: AppTypography.textTheme.labelSmall?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.school_outlined, color: AppColors.textSecondary, size: 20),
            filled: true,
            fillColor: AppColors.surfaceElevated.withOpacity(0.5),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            hintText: 'e.g., my-college',
            hintStyle: TextStyle(color: AppColors.textSecondary.withOpacity(0.5)),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter College ID';
            }
            return null;
          },
        ),
      ],
    );
  }
}
