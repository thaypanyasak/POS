import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/localization/lo.dart';
import '../../../../domain/models/sale_transaction.dart';
import '../controllers/cart_controller.dart';
import '../controllers/transaction_controller.dart';
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
      text: initialName == 'ລູກຄ້າທົ່ວໄປ' ? '' : initialName,
    );
  }

  @override
  void dispose() {
    _customerController.dispose();
    _customerFocusNode.dispose();
    super.dispose();
  }

  void _showCustomerSelector(BuildContext context) {
    final historyState = ref.read(transactionHistoryProvider);
    final currentCustomer = ref.read(cartProvider).customer;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                LaoStrings.selectCustomer,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 12),
              ListTile(
                leading: const CircleAvatar(
                  backgroundColor: AppColors.surfaceSubtle,
                  child: Icon(Icons.person_outline, color: AppColors.primary, size: 20),
                ),
                title: const Text('ລູກຄ້າທົ່ວໄປ (Walk-in)'),
                trailing: currentCustomer.id == 'walk_in'
                    ? const Icon(Icons.check, color: AppColors.primary)
                    : null,
                onTap: () {
                  ref.read(cartProvider.notifier).setCustomer(PosCustomer.walkIn);
                  _customerController.text = '';
                  Navigator.of(ctx).pop();
                },
              ),
              const Divider(height: 1),
              ...historyState.customers.map((cust) {
                final isSelected = cust.id == currentCustomer.id;
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: cust.type == CustomerType.regular
                        ? AppColors.wholesaleLight
                        : AppColors.primaryLight,
                    child: Icon(
                      cust.type == CustomerType.regular
                          ? Icons.star
                          : Icons.person,
                      color: cust.type == CustomerType.regular
                          ? AppColors.wholesaleDark
                          : AppColors.primaryDark,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    cust.name,
                    style: TextStyle(
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                  subtitle: cust.phone != null ? Text(cust.phone!) : null,
                  trailing: isSelected
                      ? const Icon(Icons.check, color: AppColors.primary)
                      : null,
                  onTap: () {
                    ref.read(cartProvider.notifier).setCustomer(cust);
                    _customerController.text = cust.name;
                    Navigator.of(ctx).pop();
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cartState = ref.watch(cartProvider);

    // Keep customer text field in sync if cart customer changes via external events (like clear cart)
    final currentCustomerName = cartState.customer.name;
    final displayedName = currentCustomerName == 'ລູກຄ້າທົ່ວໄປ' ? '' : currentCustomerName;
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
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(bottom: BorderSide(color: AppColors.border, width: 0.9)),
            ),
            child: Column(
              children: [
                // Row 1: Customer Name Input + Hold / Clear actions
                Row(
                  children: [
                    // Customer Name Input Field
                    Expanded(
                      child: Container(
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSubtle,
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: AppColors.border, width: 0.9),
                        ),
                        child: TextField(
                          controller: _customerController,
                          focusNode: _customerFocusNode,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 10,
                            ),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            hintText: 'ໃສ່ຊື່ລູກຄ້າ (e.g. ແມ່ຄຳ, ອ້າຍສົມຊາຍ...)',
                            hintStyle: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.normal,
                            ),
                            prefixIcon: const Icon(
                              Icons.person_outline_rounded,
                              size: 18,
                              color: AppColors.primary,
                            ),
                            suffixIcon: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (_customerController.text.isNotEmpty)
                                  IconButton(
                                    icon: const Icon(Icons.clear, size: 14),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                                    onPressed: () {
                                      _customerController.clear();
                                      ref.read(cartProvider.notifier).setCustomerName('');
                                    },
                                    tooltip: 'ລຶບຊື່',
                                  ),
                                IconButton(
                                  icon: const Icon(Icons.arrow_drop_down, size: 18),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                                  onPressed: () => _showCustomerSelector(context),
                                  tooltip: 'ເລືອກລູກຄ້າປະຈຳ',
                                ),
                              ],
                            ),
                          ),
                          onChanged: (val) {
                            ref.read(cartProvider.notifier).setCustomerName(val);
                          },
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Hold order button
                    IconButton(
                      onPressed: cartState.isEmpty
                          ? (cartState.heldOrders.isNotEmpty
                              ? () => ref.read(cartProvider.notifier).recallLastOrder()
                              : null)
                          : () => ref.read(cartProvider.notifier).holdCurrentOrder(),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.surfaceSubtle,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: Badge(
                        isLabelVisible: cartState.heldOrders.isNotEmpty,
                        label: Text('${cartState.heldOrders.length}'),
                        backgroundColor: AppColors.wholesale,
                        child: Icon(
                          cartState.isEmpty && cartState.heldOrders.isNotEmpty
                              ? Icons.unarchive_outlined
                              : Icons.pause_circle_outline,
                          size: 19,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      tooltip: cartState.isEmpty && cartState.heldOrders.isNotEmpty
                          ? LaoStrings.recallOrder
                          : LaoStrings.holdOrder,
                    ),

                    const SizedBox(width: 4),

                    // Clear cart button
                    IconButton(
                      onPressed: cartState.isEmpty
                          ? null
                          : () {
                              ref.read(cartProvider.notifier).clearCart();
                              _customerController.clear();
                            },
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.surfaceSubtle,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(
                        Icons.delete_sweep_outlined,
                        size: 19,
                        color: AppColors.error,
                      ),
                      tooltip: LaoStrings.clearCart,
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
                      );
                    },
                  ),
          ),

          // Bottom Checkout Dock
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
                // Subtotal & Discount rows
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${LaoStrings.subtotal} (${cartState.totalQuantity} ຊິ້ນ):',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontSize: 12.5,
                      ),
                    ),
                    Text(
                      LaoCurrencyFormatter.format(cartState.subtotal),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),

                if (cartState.discountTotal > 0) ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${LaoStrings.discount}:',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.error,
                          fontSize: 12.5,
                        ),
                      ),
                      Text(
                        '-${LaoCurrencyFormatter.format(cartState.discountTotal)}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.error,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 8),

                // Prominent Total in Lao Kip
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      LaoStrings.total,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      LaoCurrencyFormatter.format(cartState.grandTotal),
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                        color: cartState.isWholesaleMode
                            ? AppColors.wholesaleDark
                            : AppColors.primaryDark,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Full-width Prominent Pay Button with subtle gradient
                SizedBox(
                  height: 48,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: cartState.isWholesaleMode
                          ? AppColors.wholesaleGradient
                          : AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: cartState.isWholesaleMode
                              ? const Color(0x33D97706)
                              : const Color(0x33059669),
                          offset: const Offset(0, 3),
                          blurRadius: 8,
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
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.payment_rounded, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            '${LaoStrings.pay} • ${LaoCurrencyFormatter.format(cartState.grandTotal)}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.2,
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
        ],
      ),
    );
  }
}
