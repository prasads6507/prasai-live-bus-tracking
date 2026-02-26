import 'package:flutter/material.dart';

class AppColors {
  // === BRAND CORE ===
  static const Color primary = Color(0xFF2F6B4F);        // Deep campus green
  static const Color primaryGlow = Color(0x4D2F6B4F);    // Primary at 30% — glow halos
  static const Color primarySoft = Color(0x1A2F6B4F);    // Primary at 10% — tinted backgrounds

  // === ACCENT ===
  static const Color accent = Color(0xFF7BC8A4);         // Mint accent
  static const Color accentSoft = Color(0x1A7BC8A4);     // Accent 10% — subtle highlights

  // === BACKGROUND SYSTEM (Light Mode) ===
  static const Color bgDeep = Color(0xFFF2FBF6);         // Very light mint — scaffold background
  static const Color bgBase = Color(0xFFFFFFFF);         // Pure white — most surfaces
  static const Color bgSurface = Color(0xFFFFFFFF);      // Elevated Surface — cards
  static const Color bgCard = Color(0xFFFFFFFF);         // Card surface — lists, inputs
  static const Color bgGlass = Color(0xFFFFFFFF);        // White base — replaced glass morphism

  // === BORDERS ===
  static const Color borderSubtle = Color(0xFFE6EFEA);   // Subtle gray-green — card borders
  static const Color borderMid = Color(0xFFD1E0D7);      // Active borders
  static const Color borderBright = Color(0xFF2F6B4F);   // Primary focus borders

  // === TEXT HIERARCHY ===
  static const Color textPrimary = Color(0xFF0F172A);    // Near Black / Charcoal — headlines
  static const Color textSecondary = Color(0xFF475569);  // Muted Slate — subtitles
  static const Color textTertiary = Color(0xFF94A3B8);   // Lighter Slate — hints/placeholders
  static const Color textInverse = Color(0xFFFFFFFF);    // White — text on primary buttons

  // === STATUS COLORS ===
  static const Color live = Color(0xFF00E5A0);           // Neon Mint — ON_ROUTE status
  static const Color liveGlow = Color(0x3300E5A0);       // Live glow
  static const Color active = Color(0xFF3B82F6);         // Electric Blue — ACTIVE status
  static const Color offline = Color(0xFF94A3B8);        // Muted — OFFLINE status
  static const Color maintenance = Color(0xFFFF3B6B);    // Rose Red — MAINTENANCE status
  static const Color success = Color(0xFF00E5A0);        // Same as live
  static const Color warning = Color(0xFFFFBE0B);        // Amber
  static const Color error = Color(0xFFFF3B6B);          // Rose Red

  // === UTILITY ===
  static const Color transparent = Colors.transparent;
  static const Color white = Colors.white;
  static const Color black = Colors.black;

  // === MAP OVERLAY TINTS ===
  static const Color mapOverlay = Color(0x66000000);     // Dark overlay on map
  static const Color busTrail = Color(0x4D2F6B4F);       // Bus path line color (tinted)

  // === BACKWARD-COMPATIBLE ALIASES ===
  // These map the old light-mode names to the new dark-mode equivalents
  // so existing screens compile while being progressively redesigned.
  static const Color background = bgDeep;
  static const Color surface = bgSurface;
  static const Color surfaceElevated = bgCard;
  static const Color divider = borderSubtle;
  static const Color info = active;
  static const Color primaryDark = Color(0xFF25563F);
}

class AppShadows {
  static BoxShadow cardShadow = BoxShadow(
    color: const Color(0xFF0F172A).withOpacity(0.04),
    blurRadius: 16, spreadRadius: 0, offset: const Offset(0, 4),
  );

  static BoxShadow primaryGlow = BoxShadow(
    color: AppColors.primary.withOpacity(0.2),
    blurRadius: 16, spreadRadius: 0, offset: const Offset(0, 4),
  );

  static BoxShadow liveGlow = BoxShadow(
    color: AppColors.live.withOpacity(0.4),
    blurRadius: 12, spreadRadius: 2, offset: const Offset(0, 0),
  );
}
