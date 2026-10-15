import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/localization/lo.dart';
import '../../../../domain/models/sale_transaction.dart';
import '../controllers/cart_controller.dart';
import 'cart_line_item_tile.dart';
import 'checkout_modal.dart';

/// Sticky 35% Right Dock: Ticket Line Items, Unit Toggles, Price Override, Tender Shortcuts, and Pay Button
class CartDock extends ConsumerStatefulWidget {
  const CartDock({super.key});

  @override
  ConsumerState<CartDock> createState() => _CartDockState();
}

class _CartDockState extends ConsumerState<CartDock> {
  late final TextEditingController _customerController;
  final FocusNode _customerFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    final initialName = ref.read(cartProvider).customer.name;
    _customerController = TextEditingController(
      text: initialName.isNotEmpty ? initialName : 'ລູກຄ້າທົ່ວໄປ',
    );
  }

  @override
  void dispose() {
    _customerController.dispose();
    _customerFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cartState = ref.watch(cartProvider);
    final screenSize = MediaQuery.of(context).size;
    final isCompactLandscape = screenSize.height < 500;

    // Keep customer text field in sync if cart customer changes via external events (like clear cart)
    final currentCustomerName = cartState.customer.name;
    final displayedName = currentCustomerName.isNotEmpty ? currentCustomerName : 'ລູກຄ້າທົ່ວໄປ';
    if (!_customerFocusNode.hasFocus && _customerController.text != displayedName) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_customerFocusNode.hasFocus) {
          _customerController.text = displayedName;
        }
      });
    }

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(left: BorderSide(color: AppColors.border, width: 1.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: Customer Input, Hold/Clear & Wholesale/Retail Mode
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: 10,
              vertical: isCompactLandscape ? 6 : 11,
            ),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(bottom: BorderSide(color: AppColors.border, width: 0.9)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Row: Cart title, item count badge, hold and clear buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.shopping_cart_outlined, size: 16, color: Color(0xFF0F766E)),
                        const SizedBox(width: 5),
                        const Text(
                          'ກະຕ່າສິນຄ້າ',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFCCFBF1), // teal-100
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${cartState.items.length} ລາຍການ',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F766E), // teal-700
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        // Hold order button
                        InkWell(
                          onTap: cartState.isEmpty
                              ? (cartState.heldOrders.isNotEmpty
                                  ? () => ref.read(cartProvider.notifier).recallLastOrder()
                                  : null)
                              : () => ref.read(cartProvider.notifier).holdCurrentOrder(),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSubtle,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppColors.borderSubtle),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  cartState.isEmpty && cartState.heldOrders.isNotEmpty
                                      ? Icons.unarchive_outlined
                                      : Icons.pause_circle_outline,
                                  size: 13,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  cartState.isEmpty && cartState.heldOrders.isNotEmpty
                                      ? 'ດຶງບິນ'
                                      : 'ພັກບິນ',
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (cartState.items.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          InkWell(
                            onTap: () {
                              ref.read(cartProvider.notifier).clearCart();
                              _customerController.clear();
                            },
                            borderRadius: BorderRadius.circular(6),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.delete_outline_rounded, size: 13, color: AppColors.error),
                                  SizedBox(width: 2),
                                  Text(
                                    'ລ້າງ',
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.error,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 7),

                // Row 2: Customer Name Input & Quick Chips (ທົ່ວໄປ, VIP)
                Row(
                  children: [
                    // Customer Name Input Field (Centered vertically, no dropdown select)
                    Expanded(
                      child: Container(
                        height: isCompactLandscape ? 32 : 36,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSubtle,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border, width: 0.9),
                        ),
                        child: TextField(
                          controller: _customerController,
                          focusNode: _customerFocusNode,
                          textAlignVertical: TextAlignVertical.center,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 0,
                            ),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            hintText: 'ລູກຄ້າທົ່ວໄປ',
                            hintStyle: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.normal,
                            ),
                            prefixIconConstraints: const BoxConstraints(
                              minWidth: 32,
                              minHeight: 32,
                            ),
                            prefixIcon: const Icon(
                              Icons.person_outline_rounded,
                              size: 16,
                              color: AppColors.textTertiary,
                            ),
                            suffixIcon: _customerController.text.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.clear, size: 13),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                                    onPressed: () {
                                      _customerController.clear();
                                      ref.read(cartProvider.notifier).setCustomerName('');
                                    },
                                    tooltip: 'ລຶບຊື່',
                                  )
                                : null,
                          ),
                          onChanged: (val) {
                            ref.read(cartProvider.notifier).setCustomerName(val);
                          },
                        ),
                      ),
                    ),

                    const SizedBox(width: 6),

                    // Quick Chips (ທົ່ວໄປ, VIP) matching web app PosScreen.jsx
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: ['ທົ່ວໄປ', 'VIP'].map((chipLabel) {
                        final isChipActive = chipLabel == 'ທົ່ວໄປ'
                            ? (_customerController.text.isEmpty || _customerController.text == 'ລູກຄ້າທົ່ວໄປ')
                            : (_customerController.text == 'VIP');
                        return Padding(
                          padding: const EdgeInsets.only(left: 4.0),
                          child: InkWell(
                            onTap: () {
                              if (chipLabel == 'ທົ່ວໄປ') {
                                _customerController.text = 'ລູກຄ້າທົ່ວໄປ';
                                ref.read(cartProvider.notifier).setCustomer(PosCustomer.walkIn);
                              } else {
                                _customerController.text = 'VIP';
                                ref.read(cartProvider.notifier).setCustomerName('VIP');
                              }
                            },
                            borderRadius: BorderRadius.circular(6),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
                              decoration: BoxDecoration(
                                color: isChipActive ? const Color(0xFFF0FDFA) : AppColors.surface, // teal-50
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: isChipActive ? const Color(0xFF2DD4BF) : AppColors.border, // teal-400
                                  width: 0.9,
                                ),
                              ),
                              child: Text(
                                chipLabel,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: isChipActive ? const Color(0xFF115E59) : AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Cart Items List
          Expanded(
            child: cartState.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSubtle,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.shopping_bag_outlined,
                              size: 38,
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            LaoStrings.emptyCart,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSecondary,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            LaoStrings.emptyCartHint,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.textMuted,
                              fontSize: 11.5,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    itemCount: cartState.items.length,
                    itemBuilder: (context, index) {
                      final item = cartState.items[index];
                      return CartLineItemTile(
                        item: item,
                        onIncrement: () => ref
                            .read(cartProvider.notifier)
                            .incrementQuantity(item.id),
                        onDecrement: () => ref
                            .read(cartProvider.notifier)
                            .decrementQuantity(item.id),
                        onRemove: () => ref
                            .read(cartProvider.notifier)
                            .removeItem(item.id),
                        onSwitchUnit: (newUnit) => ref
                            .read(cartProvider.notifier)
                            .switchUnit(item.id, newUnit),
                        onPriceOverride: (newPrice, reason) => ref
                            .read(cartProvider.notifier)
                            .applyPriceOverride(item.id, newPrice,
                                reason: reason),
                        onResetPriceOverride: () => ref
                            .read(cartProvider.notifier)
                            .resetPriceOverride(item.id),
                        onSetQuantity: (newQty) => ref
                            .read(cartProvider.notifier)
                            .updateQuantity(item.id, newQty),
                        onToggleCrateDeposit: (val) => ref
                            .read(cartProvider.notifier)
                            .toggleCrateDeposit(item.id, val),
                        onUpdateMissingCrates: (count) => ref
                            .read(cartProvider.notifier)
                            .updateMissingCrates(item.id, count),
                      );
                    },
                  ),
          ),

          // Bottom Checkout Dock
          SafeArea(
            top: false,
            left: false,
            right: false,
            bottom: true,
            child: Container(
              padding: EdgeInsets.fromLTRB(
                10,
                isCompactLandscape ? 5 : 8,
                10,
                isCompactLandscape ? 6 : 8,
              ),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.border, width: 0.9)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x0A0F172A),
                    offset: Offset(0, -3),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Subtotal row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        cartState.totalCrateDeposit > 0
                            ? 'ລວມເງິນສິນຄ້າ (Subtotal):'
                            : '${LaoStrings.subtotal} (${cartState.totalQuantity} ຊິ້ນ):',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontSize: isCompactLandscape ? 10.5 : 11.5,
                        ),
                      ),
                      Text(
                        LaoCurrencyFormatter.format(
                          cartState.totalCrateDeposit > 0
                              ? cartState.pureGoodsSubtotal
                              : cartState.subtotal,
                        ),
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: isCompactLandscape ? 10.5 : 11.5,
                        ),
                      ),
                    ],
                  ),

                  // Crate Deposit row if applicable
                  if (cartState.totalCrateDeposit > 0) ...[
                    const SizedBox(height: 2),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'ຄ່າມັດຈຳແກັດ (Crate Deposit):',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: const Color(0xFFB45309), // amber-700
                            fontWeight: FontWeight.w700,
                            fontSize: isCompactLandscape ? 10.5 : 11.5,
                          ),
                        ),
                        Text(
                          '+${LaoCurrencyFormatter.format(cartState.totalCrateDeposit)}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFFB45309),
                            fontSize: isCompactLandscape ? 10.5 : 11.5,
                          ),
                        ),
                      ],
                    ),
                  ],

                  if (cartState.discountTotal > 0) ...[
                    const SizedBox(height: 2),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${LaoStrings.discount}:',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.error,
                            fontSize: isCompactLandscape ? 10.5 : 11.5,
                          ),
                        ),
                        Text(
                          '-${LaoCurrencyFormatter.format(cartState.discountTotal)}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.error,
                            fontSize: isCompactLandscape ? 10.5 : 11.5,
                          ),
                        ),
                      ],
                    ),
                  ],

                  SizedBox(height: isCompactLandscape ? 2 : 4),

                  // Prominent Total in Lao Kip
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        LaoStrings.total,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: isCompactLandscape ? 12.5 : 13.5,
                        ),
                      ),
                      Text(
                        LaoCurrencyFormatter.format(cartState.grandTotal),
                        style: TextStyle(
                          fontSize: isCompactLandscape ? 18 : 22,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                          color: cartState.isWholesaleMode
                              ? AppColors.wholesaleDark
                              : AppColors.primaryDark,
                        ),
                      ),
                    ],
                  ),

                  SizedBox(height: isCompactLandscape ? 5 : 8),

                  // Full-width Prominent Pay Button with subtle gradient
                  SizedBox(
                    height: isCompactLandscape ? 40 : 48,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: cartState.isWholesaleMode
                            ? AppColors.wholesaleGradient
                            : AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(9),
                        boxShadow: [
                          BoxShadow(
                            color: cartState.isWholesaleMode
                                ? const Color(0x33D97706)
                                : const Color(0x33059669),
                            offset: const Offset(0, 2),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: cartState.isEmpty
                            ? null
                            : () {
                                showDialog(
                                  context: context,
                                  builder: (ctx) => const CheckoutModal(),
                                );
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(9),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.payment_rounded, size: isCompactLandscape ? 18 : 20),
                            const SizedBox(width: 6),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                '${LaoStrings.pay} • ${LaoCurrencyFormatter.format(cartState.grandTotal)}',
                                style: TextStyle(
                                  fontSize: isCompactLandscape ? 14 : 16,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
