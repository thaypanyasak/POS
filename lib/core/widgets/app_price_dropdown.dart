import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../localization/lao_currency_formatter.dart';
import '../theme/app_theme.dart';

/// Modern Flat Price Tier Dropdown for MeiiShop POS
/// - Right-aligned popup (opens leftward) to prevent overflow on mobile & landscape tablet
/// - Width 260px - 280px
/// - Displays tier name on the left, bold currency amount on the right with green checkmark
class AppPriceDropdown extends StatelessWidget {
  final int currentTier;
  final int price1;
  final int? price2;
  final int? price3;
  final ValueChanged<int>? onSelectTier;
  final bool isCompact;

  const AppPriceDropdown({
    super.key,
    required this.currentTier,
    required this.price1,
    this.price2,
    this.price3,
    this.onSelectTier,
    this.isCompact = true,
  });

  void _showDropdownMenu(BuildContext context) {
    final RenderBox button = context.findRenderObject()! as RenderBox;
    final RenderBox overlay = Overlay.of(context).context.findRenderObject()! as RenderBox;

    final buttonRect = Rect.fromPoints(
      button.localToGlobal(Offset.zero, ancestor: overlay),
      button.localToGlobal(button.size.bottomRight(Offset.zero), ancestor: overlay),
    );

    const double menuWidth = 275.0;

    // Anchor menu to right edge of button so it expands leftward
    double left = buttonRect.right - menuWidth;
    if (left < 8.0) left = 8.0; // Prevent clipping left on tiny screens
    final double right = overlay.size.width - buttonRect.right;
    final double top = buttonRect.bottom + 4.0;
    final double bottom = overlay.size.height - top;

    final position = RelativeRect.fromLTRB(left, top, right > 0 ? right : 8.0, bottom);

    final p2 = price2 ?? 0;
    final p3 = price3 ?? 0;

    final items = <PopupMenuEntry<int>>[];

    Widget buildMenuItem({
      required int tier,
      required String title,
      required int price,
      required bool isSelected,
      required bool isEnabled,
    }) {
      final Color activeColor = tier == 3
          ? AppColors.warning
          : (tier == 2 ? const Color(0xFF0284C7) : AppColors.primary);

      return InkWell(
        onTap: isEnabled ? () => Navigator.of(context).pop(tier) : null,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          color: isSelected ? activeColor.withValues(alpha: 0.08) : Colors.transparent,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left: Title
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  PhosphorIcon(
                    PhosphorIconsBold.tag,
                    size: 14,
                    color: isSelected ? activeColor : AppColors.textMuted,
                  ),
                  const SizedBox(width: 7),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 12.0,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: isEnabled
                          ? (isSelected ? activeColor : AppColors.textMain)
                          : AppColors.textMuted,
                      letterSpacing: -0.2,
                    ),
                  ),
                ],
              ),

              // Right: Price + Checkmark
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isEnabled) ...[
                    Text(
                      '${LaoCurrencyFormatter.formatDots(price)} ₭',
                      style: TextStyle(
                        fontSize: 12.0,
                        fontWeight: FontWeight.w800,
                        fontFamily: 'monospace',
                        color: isSelected ? activeColor : AppColors.textMain,
                      ),
                    ),
                    if (isSelected) ...[
                      const SizedBox(width: 6),
                      PhosphorIcon(
                        PhosphorIconsBold.check,
                        size: 15,
                        color: activeColor,
                      ),
                    ],
                  ] else
                    const Text(
                      '(ບໍ່ກຳນົດ)',
                      style: TextStyle(
                        fontSize: 11.0,
                        fontStyle: FontStyle.italic,
                        color: AppColors.textMuted,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    // Tier 1 (Always enabled)
    items.add(
      PopupMenuItem<int>(
        value: 1,
        padding: EdgeInsets.zero,
        height: 40,
        child: buildMenuItem(
          tier: 1,
          title: 'ລາຄາ 1 (ມາດຕະຖານ)',
          price: price1,
          isSelected: currentTier == 1,
          isEnabled: true,
        ),
      ),
    );

    // Tier 2
    if (p2 > 0) {
      items.add(const PopupMenuDivider(height: 1));
      items.add(
        PopupMenuItem<int>(
          value: 2,
          padding: EdgeInsets.zero,
          height: 40,
          child: buildMenuItem(
            tier: 2,
            title: 'ລາຄາ 2 (ລູກຄ້າປະຈຳ)',
            price: p2,
            isSelected: currentTier == 2,
            isEnabled: true,
          ),
        ),
      );
    }

    // Tier 3
    if (p3 > 0) {
      items.add(const PopupMenuDivider(height: 1));
      items.add(
        PopupMenuItem<int>(
          value: 3,
          padding: EdgeInsets.zero,
          height: 40,
          child: buildMenuItem(
            tier: 3,
            title: 'ລາຄາ 3 (ຂາຍສົ່ງ / VIP)',
            price: p3,
            isSelected: currentTier == 3,
            isEnabled: true,
          ),
        ),
      );
    }

    showMenu<int>(
      context: context,
      position: position,
      items: items,
      elevation: 6,
      shadowColor: const Color(0x1F0F172A),
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border, width: 1.0),
      ),
    ).then((selected) {
      if (selected != null && onSelectTier != null) {
        onSelectTier!(selected);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final Color bgColor;
    final Color borderColor;
    final Color textColor;

    switch (currentTier) {
      case 3:
        bgColor = AppColors.warningLight;
        borderColor = const Color(0xFFFDE68A); // amber-200
        textColor = const Color(0xFFB45309); // amber-700
        break;
      case 2:
        bgColor = const Color(0xFFF0F9FF); // sky-50
        borderColor = const Color(0xFFBAE6FD); // sky-200
        textColor = const Color(0xFF0369A1); // sky-700
        break;
      default:
        bgColor = const Color(0xFFF8FAFC); // slate-50
        borderColor = const Color(0xFFE2E8F0); // slate-200
        textColor = const Color(0xFF334155); // slate-700
        break;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onSelectTier != null ? () => _showDropdownMenu(context) : null,
        borderRadius: BorderRadius.circular(7),
        child: Ink(
          height: isCompact ? 26 : 32,
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(7),
            border: Border.all(color: borderColor, width: 0.9),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                'ລາຄາ $currentTier',
                style: TextStyle(
                  fontSize: isCompact ? 10.0 : 11.5,
                  fontWeight: FontWeight.w800,
                  color: textColor,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(width: 3),
              PhosphorIcon(
                PhosphorIconsBold.caretDown,
                size: isCompact ? 10 : 12,
                color: textColor,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
