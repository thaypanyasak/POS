import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../theme/app_theme.dart';

/// Modern Tailwind Input Field for MeiiShop POS & ERP
/// - Exactly 40-42px high
/// - Tabular Mono Figures support for financial numbers
/// - Slate-200 border transitioning to Teal-600 on focus
class AppTextField extends StatelessWidget {
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final String? label;
  final String? hintText;
  final String? prefixText;
  final String? suffixText;
  final PhosphorIconData? prefixIcon;
  final Widget? suffixIcon;
  final TextInputType keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FormFieldValidator<String>? validator;
  final bool readOnly;
  final bool enabled;
  final bool isMonospace;
  final bool autofocus;
  final int maxLines;
  final TextAlign textAlign;
  final double height;

  const AppTextField({
    super.key,
    this.controller,
    this.focusNode,
    this.label,
    this.hintText,
    this.prefixText,
    this.suffixText,
    this.prefixIcon,
    this.suffixIcon,
    this.keyboardType = TextInputType.text,
    this.inputFormatters,
    this.onChanged,
    this.onSubmitted,
    this.validator,
    this.readOnly = false,
    this.enabled = true,
    this.isMonospace = false,
    this.autofocus = false,
    this.maxLines = 1,
    this.textAlign = TextAlign.start,
    this.height = 42.0,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveStyle = TextStyle(
      fontSize: 13.5,
      fontWeight: isMonospace ? FontWeight.w700 : FontWeight.w500,
      fontFamily: isMonospace ? 'monospace' : null,
      fontFeatures: const [FontFeature.tabularFigures()],
      color: enabled ? AppColors.textMain : AppColors.textMuted,
      letterSpacing: -0.2,
    );

    final inputWidget = SizedBox(
      height: maxLines == 1 ? height : null,
      child: TextFormField(
        controller: controller,
        focusNode: focusNode,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        onChanged: onChanged,
        onFieldSubmitted: onSubmitted,
        validator: validator,
        readOnly: readOnly,
        enabled: enabled,
        autofocus: autofocus,
        maxLines: maxLines,
        textAlign: textAlign,
        style: effectiveStyle,
        decoration: InputDecoration(
          isDense: true,
          filled: true,
          fillColor: enabled ? (readOnly ? AppColors.secondary : Colors.white) : AppColors.secondary,
          hintText: hintText,
          hintStyle: const TextStyle(
            fontSize: 13.0,
            fontWeight: FontWeight.w400,
            color: Color(0xFF94A3B8), // slate-400
          ),
          prefixText: prefixText,
          prefixStyle: const TextStyle(
            fontSize: 13.0,
            fontWeight: FontWeight.bold,
            color: AppColors.secondaryText,
          ),
          suffixText: suffixText,
          suffixStyle: const TextStyle(
            fontSize: 12.0,
            fontWeight: FontWeight.bold,
            color: AppColors.secondaryText,
          ),
          prefixIcon: prefixIcon != null
              ? Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: PhosphorIcon(prefixIcon!, size: 18, color: AppColors.textMuted),
                )
              : null,
          prefixIconConstraints: const BoxConstraints(minWidth: 38, minHeight: 38),
          suffixIcon: suffixIcon,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.border, width: 1.0),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.border, width: 1.0),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.borderFocus, width: 1.5),
          ),
          disabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.border, width: 0.8),
          ),
        ),
      ),
    );

    if (label == null || label!.isEmpty) {
      return inputWidget;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label!,
          style: const TextStyle(
            fontSize: 12.0,
            fontWeight: FontWeight.w700,
            color: AppColors.textMain,
            letterSpacing: -0.2,
          ),
        ),
        const SizedBox(height: 5),
        inputWidget,
      ],
    );
  }
}
