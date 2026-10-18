import 'package:flutter/material.dart';

/// Design System Color Palette for MeiiShop POS & ERP
/// Synchronized 100% with Web App (Tailwind CSS / Slate & Teal Palette)
class AppColors {
  AppColors._();

  // Background & Surface
  static const Color background = Color(0xFFF8FAFC); // Slate-50
  static const Color backgroundAlt = Color(0xFFF1F5F9); // Slate-100
  static const Color surface = Colors.white;
  static const Color surfaceElevated = Colors.white;
  static const Color surfaceSubtle = Color(0xFFF1F5F9); // Slate-100
  static const Color surfaceDark = Color(0xFF0F172A); // Slate-900
  static const Color surfaceDarkAlt = Color(0xFF1E293B); // Slate-800

  // Shadows & Subtle Overlays
  static const Color shadowSubtle = Color(0x0A0F172A);
  static const List<BoxShadow> cardShadow = [
    BoxShadow(
      color: Color(0x0A0F172A),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  // Borders
  static const Color border = Color(0xFFE2E8F0); // Slate-200
  static const Color borderSubtle = Color(0xFFF1F5F9);
  static const Color borderFocus = Color(0xFF0D9488); // Teal-600

  // Primary Teal Palette (Matching Web App)
  static const Color primary = Color(0xFF0D9488); // Teal-600
  static const Color primaryHover = Color(0xFF0F766E); // Teal-700
  static const Color primaryDark = Color(0xFF0F766E); // Teal-700
  static const Color primaryLight = Color(0xFFF0FDFA); // Teal-50
  static const Color primaryBorder = Color(0xFF99F6E4); // Teal-200
  static const Color primaryMuted = Color(0xFF14B8A6); // Teal-500
  static const Color textOnPrimary = Colors.white;

  // Secondary & Slate Text
  static const Color secondary = Color(0xFFF1F5F9); // Slate-100
  static const Color secondaryText = Color(0xFF475569); // Slate-600
  static const Color textMain = Color(0xFF0F172A); // Slate-900
  static const Color textPrimary = Color(0xFF0F172A); // Slate-900
  static const Color textSecondary = Color(0xFF475569); // Slate-600
  static const Color textTertiary = Color(0xFF64748B); // Slate-500
  static const Color textMuted = Color(0xFF64748B); // Slate-500

  // Warning & Amber Accents (Wholesale / Missing Stock)
  static const Color warning = Color(0xFFF59E0B); // Amber-500
  static const Color warningLight = Color(0xFFFFFBEB); // Amber-50
  static const Color amber500 = Color(0xFFF59E0B);
  static const Color amber50 = Color(0xFFFFFBEB);
  static const Color amber700 = Color(0xFFB45309);
  static const Color amber200 = Color(0xFFFDE68A);
  static const Color wholesale = Color(0xFFD97706); // Amber-600
  static const Color wholesaleDark = Color(0xFFB45309); // Amber-700
  static const Color wholesaleLight = Color(0xFFFEF3C7); // Amber-100
  static const Color wholesaleBorder = Color(0xFFFDE68A); // Amber-200
  static const Color textOnWholesale = Colors.white;

  // Danger & Rose Accents (Controlled Negative Stock / Errors)
  static const Color danger = Color(0xFFEF4444); // Rose-500
  static const Color dangerLight = Color(0xFFFEF2F2); // Rose-50
  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFFEF2F2);
  static const Color errorBorder = Color(0xFFFECDD3); // Rose-200
  static const Color rose500 = Color(0xFFEF4444);
  static const Color rose50 = Color(0xFFFEF2F2);
  static const Color rose700 = Color(0xFFBE123C);
  static const Color rose200 = Color(0xFFFECDD3);

  // Success Emerald
  static const Color success = Color(0xFF10B981); // Emerald-500
  static const Color successDark = Color(0xFF059669);
  static const Color successLight = Color(0xFFECFDF5);
  static const Color successBorder = Color(0xFFA7F3D0);

  // Info Blue
  static const Color info = Color(0xFF2563EB); // Blue-600
  static const Color infoLight = Color(0xFFEFF6FF); // Blue-50
  static const Color infoBorder = Color(0xFFBFDBFE);

  // Beer Special Accent
  static const Color beer = Color(0xFFB45309);
  static const Color beerLight = Color(0xFFFFFBEB);
  static const Color beerBorder = Color(0xFFFDE68A);

  // Modern Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0D9488), Color(0xFF0F766E)],
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
}
