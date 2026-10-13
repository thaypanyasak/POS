import 'package:flutter/material.dart';

/// Design System Color Palette for MeiiShop POS
/// Modern, clean, and professional aesthetic (Apple / Linear / Square POS inspired)
/// - Crisp neutral slate backgrounds (#F8FAFC, #F1F5F9)
/// - Deep Slate Typography (#0F172A, #475569)
/// - Refined Emerald Jade Primary (#059669, #047857)
/// - Warm Amber for Wholesale / Cartons (#D97706, #B45309)
/// - Subtle borders & micro-elevation shadows
class AppColors {
  AppColors._();

  // Primary Emerald / Jade Accents
  static const Color primary = Color(0xFF059669); // Emerald 600
  static const Color primaryDark = Color(0xFF047857); // Emerald 700
  static const Color primaryLight = Color(0xFFECFDF5); // Emerald 50
  static const Color primaryBorder = Color(0xFFA7F3D0); // Emerald 200
  static const Color primaryMuted = Color(0xFF10B981); // Emerald 500

  // Wholesale / Carton / Amber Accents
  static const Color wholesale = Color(0xFFD97706); // Amber 600
  static const Color wholesaleDark = Color(0xFFB45309); // Amber 700
  static const Color wholesaleLight = Color(0xFFFEF3C7); // Amber 100
  static const Color wholesaleBorder = Color(0xFFFDE68A); // Amber 200

  // Beer Special Accent (Golden Amber)
  static const Color beer = Color(0xFFB45309);
  static const Color beerLight = Color(0xFFFFFBEB);
  static const Color beerBorder = Color(0xFFFDE68A);

  // Backgrounds & Surfaces
  static const Color background = Color(0xFFF8FAFC); // Slate 50
  static const Color backgroundAlt = Color(0xFFF1F5F9); // Slate 100
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color surfaceSubtle = Color(0xFFF1F5F9);
  static const Color surfaceDark = Color(0xFF0F172A); // Slate 900
  static const Color surfaceDarkAlt = Color(0xFF1E293B); // Slate 800

  // Typography & Content
  static const Color textPrimary = Color(0xFF0F172A); // Slate 900
  static const Color textSecondary = Color(0xFF475569); // Slate 600
  static const Color textTertiary = Color(0xFF64748B); // Slate 500
  static const Color textMuted = Color(0xFF94A3B8); // Slate 400
  static const Color textOnPrimary = Color(0xFFFFFFFF);
  static const Color textOnWholesale = Color(0xFFFFFFFF);

  // Borders & Structural Dividers
  static const Color border = Color(0xFFE2E8F0); // Slate 200
  static const Color borderSubtle = Color(0xFFEEF2F6);
  static const Color borderFocus = Color(0xFF059669);

  // Functional & Alerts
  static const Color error = Color(0xFFDC2626); // Red 600
  static const Color errorLight = Color(0xFFFEE2E2); // Red 100
  static const Color errorBorder = Color(0xFFFECACA);
  static const Color warning = Color(0xFFD97706);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color success = Color(0xFF059669);
  static const Color successLight = Color(0xFFECFDF5);
  static const Color info = Color(0xFF2563EB); // Blue 600
  static const Color infoLight = Color(0xFFEFF6FF); // Blue 50
  static const Color infoBorder = Color(0xFFBFDBFE);

  // Modern Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF059669), Color(0xFF047857)],
  );

  static const LinearGradient wholesaleGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
  );

  static const LinearGradient darkCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
  );

  // Shadows
  static const Color shadowSubtle = Color(0x080F172A);
  static const Color shadowMedium = Color(0x120F172A);

  static const List<BoxShadow> cardShadow = [
    BoxShadow(
      color: Color(0x060F172A),
      offset: Offset(0, 2),
      blurRadius: 6,
    ),
  ];

  static const List<BoxShadow> hoverShadow = [
    BoxShadow(
      color: Color(0x0C0F172A),
      offset: Offset(0, 4),
      blurRadius: 12,
    ),
  ];
}
