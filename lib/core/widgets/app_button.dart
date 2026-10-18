import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../theme/app_theme.dart';

enum AppButtonVariant {
  primary,
  secondary,
  danger,
  outline,
  ghost,
}

enum AppButtonSize {
  sm,
  md,
  lg,
}

/// Modern Flat Tailwind Button for MeiiShop
/// - Anti-Material (no bulky shadows or default ElevatedButton elevation)
/// - Exact 40-44px height, 10px border radius
/// - Phosphor icon aligned perfectly with text
class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final PhosphorIconData? icon;
  final Widget? customIcon;
  final bool isLoading;
  final bool isFullWidth;
  final double? width;
  final double? height;

  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.md,
    this.icon,
    this.customIcon,
    this.isLoading = false,
    this.isFullWidth = false,
    this.width,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final bool isDisabled = onPressed == null || isLoading;

    // Dimensions based on size
    final double btnHeight = height ??
        switch (size) {
          AppButtonSize.sm => 34.0,
          AppButtonSize.md => 42.0,
          AppButtonSize.lg => 48.0,
        };

    final EdgeInsetsGeometry padding = switch (size) {
      AppButtonSize.sm => const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      AppButtonSize.md => const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      AppButtonSize.lg => const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
    };

    final double fontSize = switch (size) {
      AppButtonSize.sm => 12.0,
      AppButtonSize.md => 13.5,
      AppButtonSize.lg => 15.0,
    };

    final double iconSize = switch (size) {
      AppButtonSize.sm => 15.0,
      AppButtonSize.md => 17.0,
      AppButtonSize.lg => 20.0,
    };

    // Color Resolution based on variant
    final Color bgColor;
    final Color textColor;
    final Color? borderColor;

    switch (variant) {
      case AppButtonVariant.primary:
        bgColor = isDisabled ? AppColors.primary.withValues(alpha: 0.5) : AppColors.primary;
        textColor = Colors.white;
        borderColor = null;
        break;
      case AppButtonVariant.secondary:
        bgColor = isDisabled ? AppColors.secondary.withValues(alpha: 0.5) : AppColors.secondary;
        textColor = AppColors.secondaryText;
        borderColor = AppColors.border;
        break;
      case AppButtonVariant.danger:
        bgColor = isDisabled ? AppColors.dangerLight.withValues(alpha: 0.5) : AppColors.dangerLight;
        textColor = AppColors.danger;
        borderColor = AppColors.errorBorder;
        break;
      case AppButtonVariant.outline:
        bgColor = Colors.white;
        textColor = AppColors.textMain;
        borderColor = AppColors.border;
        break;
      case AppButtonVariant.ghost:
        bgColor = Colors.transparent;
        textColor = AppColors.secondaryText;
        borderColor = null;
        break;
    }

    Widget content = Row(
      mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (isLoading)
          SizedBox(
            width: iconSize,
            height: iconSize,
            child: CircularProgressIndicator(
              strokeWidth: 2.0,
              valueColor: AlwaysStoppedAnimation<Color>(textColor),
            ),
          )
        else if (customIcon != null)
          customIcon!
        else if (icon != null)
          PhosphorIcon(icon!, size: iconSize, color: textColor),
        if ((isLoading || icon != null || customIcon != null) && label.isNotEmpty)
          const SizedBox(width: 7),
        if (label.isNotEmpty)
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: textColor,
              letterSpacing: -0.2,
            ),
          ),
      ],
    );

    return SizedBox(
      width: isFullWidth ? double.infinity : width,
      height: btnHeight,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: isDisabled ? null : onPressed,
          borderRadius: BorderRadius.circular(10),
          child: Ink(
            padding: padding,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(10),
              border: borderColor != null ? Border.all(color: borderColor, width: 1.0) : null,
            ),
            child: Center(child: content),
          ),
        ),
      ),
    );
  }
}
