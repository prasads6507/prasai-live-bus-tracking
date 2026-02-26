import 'package:flutter/material.dart';

class AppColors {
  // === BRAND CORE ===
  static const Color primary = Color(0xFFFF6B35);        // Vivid Tangerine — CTAs, live indicators
  static const Color primaryGlow = Color(0x4DFF6B35);    // Primary at 30% — glow halos
  static const Color primarySoft = Color(0x1AFF6B35);    // Primary at 10% — tinted backgrounds

  // === ACCENT ===
  static const Color accent = Color(0xFFFFBE0B);         // Golden Amber — achievements, warnings
  static const Color accentSoft = Color(0x1AFFBE0B);     // Accent 10% — subtle highlights

  // === BACKGROUND SYSTEM (Dark Mode) ===
  static const Color bgDeep = Color(0xFF0A0E1A);         // Deepest Navy — scaffold background
  static const Color bgBase = Color(0xFF0F1629);         // Base Navy — most surfaces
  static const Color bgSurface = Color(0xFF162040);      // Elevated Surface — cards
  static const Color bgCard = Color(0xFF1C2952);         // Card surface — lists, inputs
  static const Color bgGlass = Color(0x1AFFFFFF);        // White 10% — glass morphism layers

  // === BORDERS ===
  static const Color borderSubtle = Color(0x1AFFFFFF);   // White 10% — card borders
  static const Color borderMid = Color(0x33FFFFFF);      // White 20% — active borders
  static const Color borderBright = Color(0x66FF6B35);   // Primary 40% — focus borders

  // === TEXT HIERARCHY ===
  static const Color textPrimary = Color(0xFFF0F4FF);    // Near White — headlines
  static const Color textSecondary = Color(0xFF8B9CC8);  // Muted Blue-Gray — subtitles
  static const Color textTertiary = Color(0xFF4A5A80);   // Dark Muted — hints/placeholders
  static const Color textInverse = Color(0xFF0A0E1A);    // Dark — text on primary buttons

  // === STATUS COLORS ===
  static const Color live = Color(0xFF00E5A0);           // Neon Mint — ON_ROUTE status
  static const Color liveGlow = Color(0x3300E5A0);       // Live glow
  static const Color active = Color(0xFF3B82F6);         // Electric Blue — ACTIVE status
  static const Color offline = Color(0xFF4A5A80);        // Muted — OFFLINE status
  static const Color maintenance = Color(0xFFFF3B6B);    // Rose Red — MAINTENANCE status
  static const Color success = Color(0xFF00E5A0);        // Same as live
  static const Color warning = Color(0xFFFFBE0B);        // Amber
  static const Color error = Color(0xFFFF3B6B);          // Rose Red

  // === UTILITY ===
  static const Color transparent = Colors.transparent;
  static const Color white = Colors.white;
  static const Color black = Colors.black;

  // === MAP OVERLAY TINTS ===
  static const Color mapOverlay = Color(0x99000000);     // Dark overlay on map
  static const Color busTrail = Color(0x4DFF6B35);       // Bus path line color (tinted)

  // === BACKWARD-COMPATIBLE ALIASES ===
  // These map the old light-mode names to the new dark-mode equivalents
  // so existing screens compile while being progressively redesigned.
  static const Color background = bgDeep;
  static const Color surface = bgSurface;
  static const Color surfaceElevated = bgCard;
  static const Color divider = borderSubtle;
  static const Color info = active;
  static const Color primaryDark = primary;
}

class AppShadows {
  static BoxShadow cardShadow = BoxShadow(
    color: const Color(0xFF000000).withOpacity(0.3),
    blurRadius: 24, spreadRadius: 0, offset: const Offset(0, 8),
  );

  static BoxShadow primaryGlow = BoxShadow(
    color: AppColors.primary.withOpacity(0.4),
    blurRadius: 20, spreadRadius: 0, offset: const Offset(0, 0),
  );

  static BoxShadow liveGlow = BoxShadow(
    color: AppColors.live.withOpacity(0.5),
    blurRadius: 16, spreadRadius: 2, offset: const Offset(0, 0),
  );
}
