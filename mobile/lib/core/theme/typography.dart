import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'colors.dart';

class AppTypography {
  // DISPLAY — Hero numbers (ETA, speed, distances)
  static TextStyle display = GoogleFonts.sora(
    fontSize: 48, fontWeight: FontWeight.w800,
    color: AppColors.textPrimary, letterSpacing: -1.0,
  );

  // HEADLINE 1 — Screen titles
  static TextStyle h1 = GoogleFonts.sora(
    fontSize: 28, fontWeight: FontWeight.w700,
    color: AppColors.textPrimary, letterSpacing: -0.8,
  );

  // HEADLINE 2 — Section headers, card titles
  static TextStyle h2 = GoogleFonts.sora(
    fontSize: 20, fontWeight: FontWeight.w700,
    color: AppColors.textPrimary, letterSpacing: -0.4,
  );

  // HEADLINE 3 — Card subtitles, list item titles
  static TextStyle h3 = GoogleFonts.sora(
    fontSize: 16, fontWeight: FontWeight.w600,
    color: AppColors.textPrimary, letterSpacing: -0.2,
  );

  // BODY LARGE — Primary body text
  static TextStyle bodyLg = GoogleFonts.dmSans(
    fontSize: 16, fontWeight: FontWeight.w500,
    color: AppColors.textPrimary, height: 1.6,
  );

  // BODY MEDIUM — Standard body
  static TextStyle bodyMd = GoogleFonts.dmSans(
    fontSize: 14, fontWeight: FontWeight.w400,
    color: AppColors.textSecondary, height: 1.5,
  );

  // LABEL — Tags, chips, badges
  static TextStyle label = GoogleFonts.sora(
    fontSize: 12, fontWeight: FontWeight.w700,
    color: AppColors.textSecondary, letterSpacing: 0.8,
  );

  // CAPTION — Timestamps, meta info
  static TextStyle caption = GoogleFonts.dmSans(
    fontSize: 11, fontWeight: FontWeight.w400,
    color: AppColors.textTertiary, letterSpacing: 0.2,
  );

  // MONO — Numbers, plates, ETA values
  static TextStyle mono = GoogleFonts.spaceMono(
    fontSize: 14, fontWeight: FontWeight.w600,
    color: AppColors.textPrimary, letterSpacing: 1.0,
  );

  // === BACKWARD-COMPATIBLE ALIAS ===
  // Maps the old TextTheme-based API to the new named styles
  // so existing screens compile during the progressive redesign.
  static TextTheme get textTheme => TextTheme(
    headlineSmall: h1,
    titleLarge: h1,
    titleMedium: h2,
    titleSmall: h3,
    bodyLarge: bodyLg,
    bodyMedium: bodyMd,
    bodySmall: bodyMd,
    labelLarge: label,
    labelMedium: label,
    labelSmall: caption,
  );
}
