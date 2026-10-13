import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:screenshot/screenshot.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/localization/lo.dart';
import '../../../../core/utils/platform_print.dart';
import '../../../../domain/models/sale_transaction.dart';
import '../controllers/cart_controller.dart';
import '../controllers/printer_controller.dart';
import '../controllers/transaction_controller.dart';
import 'meii_receipt_slip.dart';
import 'quick_cash_keypad.dart';

/// Checkout & Tender Modal
class CheckoutModal extends ConsumerStatefulWidget {
  const CheckoutModal({super.key});

  @override
  ConsumerState<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends ConsumerState<CheckoutModal> {
  PaymentMethod _paymentMethod = PaymentMethod.cash;
  int _tenderedAmount = 0;
  bool _shouldPrintReceipt = true;
  SaleTransaction? _completedTransaction;
  final ScreenshotController _receiptScreenshotController = ScreenshotController();

  @override
  void initState() {
    super.initState();
    final grandTotal = ref.read(cartProvider).grandTotal;
    _tenderedAmount = grandTotal; // Default to exact amount
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cartState = ref.watch(cartProvider);
    final printerState = ref.watch(printerProvider);

    if (_completedTransaction != null) {
      return _buildSuccessView(context, _completedTransaction!);
    }

    final change = LaoCurrencyFormatter.calculateChange(_tenderedAmount, cartState.grandTotal);
    final isCashSufficient = _paymentMethod == PaymentMethod.qrTransfer || _tenderedAmount >= cartState.grandTotal;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620, maxHeight: 720),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        LaoStrings.pay,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${cartState.customer.name} • ${cartState.isWholesaleMode ? LaoStrings.wholesale : LaoStrings.retail}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Total Due Banner
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                decoration: BoxDecoration(
                  gradient: cartState.isWholesaleMode
                      ? AppColors.wholesaleGradient
                      : AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: cartState.isWholesaleMode
                          ? const Color(0x26D97706)
                          : const Color(0x26059669),
                      offset: const Offset(0, 4),
                      blurRadius: 10,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          LaoStrings.netTotal,
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${cartState.items.length} ${LaoStrings.products} (${cartState.totalQuantity} ຊິ້ນ)',
                          style: const TextStyle(
                            color: Colors.white60,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      LaoCurrencyFormatter.format(cartState.grandTotal),
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Payment Method Tabs
              Row(
                children: [
                  Expanded(
                    child: _buildPaymentTab(
                      method: PaymentMethod.cash,
                      icon: Icons.payments_rounded,
                      label: LaoStrings.cash,
                      isSelected: _paymentMethod == PaymentMethod.cash,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildPaymentTab(
                      method: PaymentMethod.qrTransfer,
                      icon: Icons.qr_code_scanner_rounded,
                      label: LaoStrings.transfer,
                      isSelected: _paymentMethod == PaymentMethod.qrTransfer,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // Tender Area
              Expanded(
                child: SingleChildScrollView(
                  child: _paymentMethod == PaymentMethod.cash
                      ? _buildCashTenderView(cartState.grandTotal, change)
                      : _buildQrTransferView(cartState.grandTotal),
                ),
              ),

              const SizedBox(height: 12),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 10),

              // Printer Options & Trigger
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Checkbox(
                        value: _shouldPrintReceipt,
                        activeColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        onChanged: (val) {
                          setState(() => _shouldPrintReceipt = val ?? true);
                        },
                      ),
                      Text(
                        '${LaoStrings.printReceipt} (ESC/POS)',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: () {
                      ref.read(printerProvider.notifier).openCashDrawer();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('ສົ່ງຄຳສັ່ງເປີດລິ້ນຊັກເງິນແລ້ວ (ESC p 0)'),
                          duration: Duration(seconds: 2),
                        ),
                      );
                    },
                    icon: const Icon(Icons.sensor_door_outlined, size: 17),
                    label: const Text(LaoStrings.openDrawer),
                  ),
                ],
              ),

              const SizedBox(height: 10),

              // Final Pay Button
              SizedBox(
                height: 48,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: isCashSufficient
                        ? AppColors.primaryGradient
                        : null,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: isCashSufficient
                        ? const [
                            BoxShadow(
                              color: Color(0x33059669),
                              offset: Offset(0, 3),
                              blurRadius: 8,
                            ),
                          ]
                        : null,
                  ),
                  child: ElevatedButton(
                    onPressed: isCashSufficient
                        ? () => _onConfirmCheckout(context, cartState.grandTotal)
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isCashSufficient
                          ? Colors.transparent
                          : AppColors.surfaceSubtle,
                      foregroundColor: isCashSufficient
                          ? Colors.white
                          : AppColors.textMuted,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: printerState.isPrinting
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              ),
                              SizedBox(width: 12),
                              Text('ກຳລັງປະມວນຜົນ...', style: TextStyle(fontWeight: FontWeight.w700)),
                            ],
                          )
                        : Text(
                            '${LaoStrings.confirmPayment} (${LaoCurrencyFormatter.format(cartState.grandTotal)})',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentTab({
    required PaymentMethod method,
    required IconData icon,
    required String label,
    required bool isSelected,
  }) {
    return InkWell(
      onTap: () => setState(() => _paymentMethod = method),
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surface : AppColors.surfaceSubtle,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 1.6 : 0.9,
          ),
          boxShadow: isSelected ? AppColors.cardShadow : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.primary : AppColors.textSecondary,
              size: 21,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? AppColors.primaryDark : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCashTenderView(int grandTotal, int change) {
    final breakdown = LaoCurrencyFormatter.breakdownChange(change);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        QuickCashKeypad(
          totalDue: grandTotal,
          currentTendered: _tenderedAmount,
          onTenderChanged: (amount) => setState(() => _tenderedAmount = amount),
          onExactTender: () => setState(() => _tenderedAmount = grandTotal),
        ),

        if (change > 0 && breakdown.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceSubtle,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ແນະນຳໃບເງິນທອນ:',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: breakdown.entries.map((entry) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        '${LaoCurrencyFormatter.format(entry.key, includeSymbol: false)} x ${entry.value} ໃບ',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildQrTransferView(int grandTotal) {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surfaceSubtle,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFDC2626), // BCEL Red
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'BCEL One / Lao QR Payment',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(height: 16),
            // QR Code image (public/qr.jpg)
            Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              padding: const EdgeInsets.all(8),
              child: Image.asset(
                'public/qr.jpg',
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Image.network(
                  'qr.jpg',
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Image.network(
                    'public/qr.jpg',
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(
                        Icons.qr_code_2,
                        size: 140,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'ຍອດໂອນ: ${LaoCurrencyFormatter.format(grandTotal)}',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'ສະແກນ QR ຜ່ານແອັບທະນາຄານເພື່ອຊຳລະເງິນ',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _onConfirmCheckout(BuildContext context, int grandTotal) async {
    final tendered = _paymentMethod == PaymentMethod.cash
        ? _tenderedAmount
        : grandTotal;

    final tx = await ref.read(transactionHistoryProvider.notifier).processCheckout(
          paymentMethod: _paymentMethod,
          amountTendered: tendered,
        );

    if (_shouldPrintReceipt) {
      await ref.read(printerProvider.notifier).printTransactionReceipt(tx);
    }

    setState(() {
      _completedTransaction = tx;
    });
  }

  Future<void> _handlePrintReceipt(BuildContext context, SaleTransaction tx) async {
    // 1. Silent ESC/POS thermal printer transmission (for physical printers)
    ref.read(printerProvider.notifier).printTransactionReceipt(tx);

    // 2. Capture isolated receipt widget to print ONLY the receipt without background UI
    try {
      final bytes = await _receiptScreenshotController.capture(pixelRatio: 2.5);
      if (bytes != null && bytes.isNotEmpty) {
        final uri = 'data:image/png;base64,${base64Encode(bytes)}';
        triggerPlatformPrintReceipt(uri);
      } else {
        triggerPlatformPrint();
      }
    } catch (_) {
      triggerPlatformPrint();
    }

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ສັ່ງພິມໃບບິນ MeiiShop ຮຽບຮ້ອຍແລ້ວ!'),
          backgroundColor: AppColors.primary,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Widget _buildSuccessView(BuildContext context, SaleTransaction tx) {
    final isCash = tx.paymentMethod == PaymentMethod.cash;
    final changeBreakdown = isCash && tx.changeAmount > 0
        ? LaoCurrencyFormatter.breakdownChange(tx.changeAmount)
        : <int, int>{};

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 880, maxHeight: 760),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 720;

            if (isWide) {
              return Padding(
                padding: const EdgeInsets.all(24.0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Left Column (40%): Outcomes & Actions
                    Expanded(
                      flex: 40,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Success Icon & Header
                          Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: AppColors.primaryLight,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                                ),
                                child: const Icon(Icons.check_circle_rounded, size: 28, color: AppColors.primary),
                              ),
                              const SizedBox(width: 12),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'ຊຳລະເງິນສຳເລັດແລ້ວ!',
                                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                                    ),
                                    Text(
                                      'ບັນທຶກລາຍການ ແລະ ຕັດສາງຮຽບຮ້ອຍ',
                                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 16),

                          // If Change Due > 0, Big Eye-catching Banner
                          if (isCash && tx.changeAmount > 0) ...[
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFF86EFAC), width: 1.2),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Row(
                                    children: [
                                      Icon(Icons.paid_outlined, color: AppColors.primaryDark, size: 18),
                                      SizedBox(width: 6),
                                      Text(
                                        'ເງິນທອນລູກຄ້າ (Change Due):',
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    LaoCurrencyFormatter.format(tx.changeAmount),
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.primaryDark,
                                    ),
                                  ),
                                  if (changeBreakdown.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    const Text(
                                      'ໃບເງິນທີ່ຕ້ອງທອນ (Banknotes):',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF166534)),
                                    ),
                                    const SizedBox(height: 4),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 4,
                                      children: changeBreakdown.entries.map((e) {
                                        return Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: const Color(0xFFBBF7D0)),
                                          ),
                                          child: Text(
                                            '${LaoCurrencyFormatter.format(e.key)} × ${e.value}',
                                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF166534)),
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],

                          // Summary Box
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSubtle,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              children: [
                                _buildSummaryRow('ເລກທີບິນ:', tx.receiptNumber, isBold: true),
                                const SizedBox(height: 6),
                                _buildSummaryRow('ຍອດຂາຍລວມ:', LaoCurrencyFormatter.format(tx.grandTotal), isBold: true),
                                const SizedBox(height: 6),
                                _buildSummaryRow(
                                  isCash ? 'ຮັບເງິນສົດມາ:' : 'ຮັບເງິນໂອນມາ:',
                                  LaoCurrencyFormatter.format(tx.amountTendered),
                                ),
                                const SizedBox(height: 6),
                                _buildSummaryRow('ວິທີຊຳລະ:', isCash ? 'ເງິນສົດ (Cash)' : 'QR ໂອນ (BCEL One)'),
                                const SizedBox(height: 6),
                                _buildSummaryRow('ລູກຄ້າ:', tx.customer.name),
                                const Divider(height: 16),
                                _buildSummaryRow('ກຳໄລຂັ້ນຕົ້ນ:', '+${LaoCurrencyFormatter.format(tx.grossProfit)}', color: AppColors.primaryDark),
                              ],
                            ),
                          ),

                          const SizedBox(height: 12),

                          // Notice regarding no physical printer
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight.withValues(alpha: 0.35),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                            ),
                            child: const Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.info_outline, size: 16, color: AppColors.primaryDark),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'ບໍ່ທັນມີເຄື່ອງພິມບິນ? ທ່ານສາມາດກວດເບິ່ງໃບບິນດິຈິຕອນຂ້າງໆນີ້ ຫຼື ກົດປຸ່ມ "ພິມໃບບິນ" ເພື່ອພິມຜ່ານ Browser / Save ເປັນ PDF ໄດ້.',
                                    style: TextStyle(fontSize: 11, color: AppColors.primaryDark, height: 1.35),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const Spacer(),

                          // Actions
                          ElevatedButton.icon(
                            onPressed: () => _handlePrintReceipt(context, tx),
                            icon: const Icon(Icons.print_rounded, size: 20),
                            label: const Text('ພິມໃບບິນ (Print Receipt)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: () => Navigator.of(context).pop(),
                            icon: const Icon(Icons.add_shopping_cart_rounded, size: 18),
                            label: const Text('ເລີ່ມບິນໃໝ່ (New Sale)', style: TextStyle(fontWeight: FontWeight.bold)),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(width: 20),

                    // Right Column (60%): MeiiShop Thermal Receipt Slip Preview
                    Expanded(
                      flex: 60,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          children: [
                            // Receipt Toolbar Header
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
                                border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Row(
                                    children: [
                                      Icon(Icons.receipt_long_rounded, size: 18, color: AppColors.primary),
                                      SizedBox(width: 8),
                                      Text(
                                        'ໃບບິນດິຈິຕອນ (Digital Receipt Preview)',
                                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                  IconButton(
                                    tooltip: 'ພິມໃບບິນ',
                                    icon: const Icon(Icons.print_outlined, size: 20, color: AppColors.primary),
                                    onPressed: () => _handlePrintReceipt(context, tx),
                                  ),
                                ],
                              ),
                            ),
                            // Scrollable Receipt Slip (Captured for print)
                            Expanded(
                              child: SingleChildScrollView(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                                child: Screenshot(
                                  controller: _receiptScreenshotController,
                                  child: MeiiReceiptSlip(transaction: tx),
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

            // Narrow / Mobile Fallback (Single Column Stack)
            return SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.check_circle_rounded, size: 28, color: AppColors.primary),
                      const SizedBox(width: 10),
                      const Text('ຊຳລະເງິນສຳເລັດ!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const Spacer(),
                      IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close)),
                    ],
                  ),
                  if (isCash && tx.changeAmount > 0) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('ເງິນທອນ:', style: TextStyle(fontWeight: FontWeight.bold)),
                          Text(
                            LaoCurrencyFormatter.format(tx.changeAmount),
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.primaryDark),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Screenshot(
                    controller: _receiptScreenshotController,
                    child: MeiiReceiptSlip(transaction: tx),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => _handlePrintReceipt(context, tx),
                    icon: const Icon(Icons.print_rounded),
                    label: const Text('ພິມໃບບິນ (Print Receipt)'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('ເລີ່ມບິນໃໝ່'),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: color ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
