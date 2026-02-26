import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'colors.dart';
import 'typography.dart';

class AppTheme {
  static ThemeData get lightTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.bgDeep,
    primaryColor: AppColors.primary,

    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      secondary: AppColors.accent,
      background: AppColors.bgDeep,
      surface: AppColors.bgSurface,
      onPrimary: AppColors.textInverse,
      onBackground: AppColors.textPrimary,
      onSurface: AppColors.textPrimary,
      error: AppColors.error,
    ),

    cardTheme: CardThemeData(
      color: AppColors.bgCard,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.borderSubtle, width: 1),
      ),
    ),

    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.bgDeep,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      iconTheme: const IconThemeData(color: AppColors.textPrimary),
      titleTextStyle: AppTypography.h2,
    ),

    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.bgBase,
      selectedItemColor: AppColors.primary,
      unselectedItemColor: AppColors.textTertiary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),

    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      elevation: 0,
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bgBase,
      hintStyle: AppTypography.bodyMd.copyWith(color: AppColors.textTertiary),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textInverse,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: AppTypography.h3,
      ),
    ),
  );

  static ThemeData get darkTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.bgDeep,
    primaryColor: AppColors.primary,

    colorScheme: const ColorScheme.dark(
      primary: AppColors.primary,
      secondary: AppColors.accent,
      background: AppColors.bgDeep,
      surface: AppColors.bgSurface,
      onPrimary: AppColors.textInverse,
      onBackground: AppColors.textPrimary,
      onSurface: AppColors.textPrimary,
      error: AppColors.error,
    ),

    cardTheme: CardThemeData(
      color: AppColors.bgCard,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.borderSubtle, width: 1),
      ),
    ),

    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.bgDeep,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      iconTheme: const IconThemeData(color: AppColors.textPrimary),
      titleTextStyle: AppTypography.h2,
    ),

    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.bgBase,
      selectedItemColor: AppColors.primary,
      unselectedItemColor: AppColors.textTertiary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bgCard,
      hintStyle: GoogleFonts.dmSans(color: AppColors.textTertiary, fontSize: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textInverse,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: AppTypography.h3,
      ),
    ),
  );
}
