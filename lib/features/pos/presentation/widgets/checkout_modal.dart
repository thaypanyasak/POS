import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:screenshot/screenshot.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/utils/platform_print.dart';
import '../../../../domain/models/sale_transaction.dart';
import '../controllers/cart_controller.dart';
import '../controllers/printer_controller.dart';
import '../controllers/transaction_controller.dart';
import 'meii_receipt_slip.dart';

/// Checkout & Tender Modal matching 100% web-app CheckoutModal.jsx
class CheckoutModal extends ConsumerStatefulWidget {
  const CheckoutModal({super.key});

  @override
  ConsumerState<CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends ConsumerState<CheckoutModal> {
  PaymentMethod _paymentMethod = PaymentMethod.cash;
  int _tenderedAmount = 0;
  int _debtPaidKip = 0;
  bool _shouldPrintReceipt = true;
  SaleTransaction? _completedTransaction;
  final ScreenshotController _receiptScreenshotController =
      ScreenshotController();

  late final TextEditingController _customerNameController;
  late final TextEditingController _cashInputController;
  late final TextEditingController _debtInputController;
  late final TextEditingController _debtNoteController;

  @override
  void initState() {
    super.initState();
    final grandTotal = ref.read(cartProvider).grandTotal;
    _tenderedAmount = grandTotal;
    _debtPaidKip = 0;

    _customerNameController = TextEditingController(
      text: ref.read(cartProvider).customer.name,
    );
    _cashInputController = TextEditingController(
      text: LaoCurrencyFormatter.formatDots(grandTotal),
    );
    _debtInputController = TextEditingController();
    _debtNoteController = TextEditingController();
  }

  @override
  void dispose() {
    _customerNameController.dispose();
    _cashInputController.dispose();
    _debtInputController.dispose();
    _debtNoteController.dispose();
    super.dispose();
  }

  void _onCashInputChanged(String val, int grandTotal) {
    final clean = val.replaceAll(RegExp(r'[^0-9]'), '');
    final numVal = int.tryParse(clean) ?? 0;
    setState(() {
      _tenderedAmount = numVal;
    });
  }

  void _onDebtInputChanged(String val, int grandTotal) {
    final clean = val.replaceAll(RegExp(r'[^0-9]'), '');
    final numVal = (int.tryParse(clean) ?? 0).clamp(0, grandTotal);
    setState(() {
      _debtPaidKip = numVal;
    });
  }

  @override
  Widget build(BuildContext context) {
    final cartState = ref.watch(cartProvider);
    final printerState = ref.watch(printerProvider);

    if (_completedTransaction != null) {
      return _buildSuccessView(context, _completedTransaction!);
    }

    final grandTotal = cartState.grandTotal;
    final change = LaoCurrencyFormatter.calculateChange(
      _tenderedAmount,
      grandTotal,
    );
    final remainingDebt = (grandTotal - _debtPaidKip).clamp(0, grandTotal);

    final isCashSufficient =
        _paymentMethod != PaymentMethod.cash || _tenderedAmount >= grandTotal;

    final screenSize = MediaQuery.of(context).size;
    final isCompactLandscape = screenSize.height < 500;
    final isMobileWidth = screenSize.width < 520;

    return Dialog(
      insetPadding: EdgeInsets.symmetric(
        horizontal: isMobileWidth ? 10 : (isCompactLandscape ? 16 : 24),
        vertical: isCompactLandscape ? 6 : (isMobileWidth ? 12 : 24),
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(isMobileWidth ? 20 : 24),
      ),
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: isCompactLandscape ? 600 : (isMobileWidth ? screenSize.width - 20 : 490),
          maxHeight: isCompactLandscape
              ? (screenSize.height - 12)
              : (screenSize.height * 0.92).clamp(520.0, 780.0),
        ),
        child: Padding(
          padding: EdgeInsets.all(
            isMobileWidth ? 12.0 : (isCompactLandscape ? 12.0 : 18.0),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Header (Matching Web CheckoutModal)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xFF0D9488),
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ຊຳລະເງິນ (Checkout)',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          Text(
                            'ເລືອກຮູບແບບການຊຳລະ: ເງິນສົດ, ໂອນ, ຫຼື ຄ້າງຊຳລະ',
                            style: TextStyle(
                              fontSize: isCompactLandscape ? 10 : 11,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(
                      Icons.close,
                      color: Color(0xFF94A3B8),
                      size: 20,
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // 2. Customer Name Editor Bar
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.person_outline_rounded,
                      color: Color(0xFF94A3B8),
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'ລູກຄ້າ:',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: TextField(
                        controller: _customerNameController,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                        decoration: const InputDecoration(
                          hintText: 'ຊື່ລູກຄ້າ ຫຼື ເບີໂທຕິດຕໍ່...',
                          hintStyle: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF94A3B8),
                          ),
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 2,
                          ),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                        ),
                        onChanged: (val) => setState(() {}),
                      ),
                    ),
                    if (_paymentMethod == PaymentMethod.debt &&
                        (_customerNameController.text.trim().isEmpty ||
                            _customerNameController.text.trim() ==
                                'ລູກຄ້າທົ່ວໄປ'))
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFCD34D)),
                        ),
                        child: const Text(
                          '⚠️ ຄວນໃສ່ຊື່ລູກຄ້າ',
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // 3. Scrollable Order Summary & Tender Details
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Order Breakdown (Grouped items + Crate deposit fees)
                      if (cartState.items.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'ລາຍການສິນຄ້າ (${cartState.items.length})',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                  const Text(
                                    'ລວມ (₭)',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                              const Divider(
                                color: Color(0xFFE2E8F0),
                                height: 12,
                              ),
                              ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxHeight: 120,
                                ),
                                child: ListView.separated(
                                  shrinkWrap: true,
                                  physics: const ClampingScrollPhysics(),
                                  itemCount: cartState.items.length,
                                  separatorBuilder:
                                      (_, __) => const SizedBox(height: 6),
                                  itemBuilder: (context, idx) {
                                    final item = cartState.items[idx];
                                    final prodName = item.product.name;
                                    final unitName = item.selectedUnit.unitName;
                                    final effectivePrice =
                                        item.effectiveUnitPrice;
                                    final baseTotal = item.lineGoodsTotal;
                                    final feePerCrate = item.feePerCrate;
                                    final missingCount =
                                        item.effectiveMissingCratesCount;
                                    final crateDepositTotal =
                                        item.crateFeeTotal;

                                    return Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                '$prodName ($unitName)',
                                                style: const TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF1E293B),
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  '${item.quantity} x ${LaoCurrencyFormatter.formatDots(effectivePrice)}',
                                                  style: const TextStyle(
                                                    fontSize: 10.5,
                                                    color: Color(0xFF64748B),
                                                    fontFamily: 'monospace',
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Text(
                                                  LaoCurrencyFormatter.format(
                                                    baseTotal,
                                                  ),
                                                  style: const TextStyle(
                                                    fontSize: 11.5,
                                                    fontWeight: FontWeight.w800,
                                                    color: Color(0xFF0F172A),
                                                    fontFamily: 'monospace',
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                        if (item.noEmptyCrates &&
                                            missingCount > 0)
                                          Container(
                                            margin: const EdgeInsets.only(
                                              top: 3,
                                            ),
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFFEF3C7),
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                              border: Border.all(
                                                color: const Color(0xFFFDE68A),
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment
                                                      .spaceBetween,
                                              children: [
                                                Text(
                                                  '* ບໍ່ມີແກັດປ່ຽນ: ($missingCount ແກັດ)',
                                                  style: const TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF78350F),
                                                  ),
                                                ),
                                                Row(
                                                  mainAxisSize:
                                                      MainAxisSize.min,
                                                  children: [
                                                    Text(
                                                      '$missingCount x ${LaoCurrencyFormatter.formatDots(feePerCrate)}',
                                                      style: const TextStyle(
                                                        fontSize: 9.5,
                                                        color: Color(
                                                          0xFFB45309,
                                                        ),
                                                        fontFamily: 'monospace',
                                                      ),
                                                    ),
                                                    const SizedBox(width: 6),
                                                    Text(
                                                      '+${LaoCurrencyFormatter.format(crateDepositTotal)}',
                                                      style: const TextStyle(
                                                        fontSize: 10.5,
                                                        fontWeight:
                                                            FontWeight.w900,
                                                        color: Color(
                                                          0xFF78350F,
                                                        ),
                                                        fontFamily: 'monospace',
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    );
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 10),

                      // Grand Total Display (Matching Web: Total Due)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          children: [
                            const Text(
                              'ຍອດເງິນທີ່ຕ້ອງຊຳລະ (Total Due)',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF64748B),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              LaoCurrencyFormatter.format(grandTotal),
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F766E),
                                letterSpacing: -0.5,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),

                      // 4. 3 Payment Tabs: Cash, Transfer, Debt
                      Row(
                        children: [
                          Expanded(
                            child: _buildPaymentTab(
                              method: PaymentMethod.cash,
                              icon: Icons.monetization_on_outlined,
                              label: 'ເງິນສົດ (Cash)',
                              isSelected: _paymentMethod == PaymentMethod.cash,
                              activeBg: const Color(0xFFF0FDFA),
                              activeBorder: const Color(0xFF14B8A6),
                              activeText: const Color(0xFF115E59),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _buildPaymentTab(
                              method: PaymentMethod.qrTransfer,
                              icon: Icons.qr_code_rounded,
                              label: 'ໂອນເງິນ (Transfer)',
                              isSelected:
                                  _paymentMethod == PaymentMethod.qrTransfer,
                              activeBg: const Color(0xFFEFF6FF),
                              activeBorder: const Color(0xFF3B82F6),
                              activeText: const Color(0xFF1E40AF),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _buildPaymentTab(
                              method: PaymentMethod.debt,
                              icon: Icons.access_time_rounded,
                              label: 'ຄ້າງຊຳລະ (Debt)',
                              isSelected: _paymentMethod == PaymentMethod.debt,
                              activeBg: const Color(0xFFFFF1F2),
                              activeBorder: const Color(0xFFFB7185),
                              activeText: const Color(0xFF9F1239),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // 5. Active Tab Content
                      if (_paymentMethod == PaymentMethod.cash)
                        _buildCashSection(grandTotal, change)
                      else if (_paymentMethod == PaymentMethod.qrTransfer)
                        _buildTransferSection(grandTotal)
                      else
                        _buildDebtSection(grandTotal, remainingDebt),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 10),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 8),

              // 6. Thermal Print Receipt Checkbox & Open Drawer
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: Checkbox(
                          value: _shouldPrintReceipt,
                          activeColor: const Color(0xFF0F766E),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(4),
                          ),
                          onChanged:
                              (val) => setState(
                                () => _shouldPrintReceipt = val ?? true,
                              ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'ພິມໃບບິນອັດຕະໂນມັດ (ESC/POS)',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: () {
                      ref.read(printerProvider.notifier).openCashDrawer();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'ສົ່ງຄຳສັ່ງເປີດລິ້ນຊັກເງິນແລ້ວ (ESC p 0)',
                          ),
                          duration: Duration(seconds: 1),
                          backgroundColor: Color(0xFF0F766E),
                        ),
                      );
                    },
                    icon: const Icon(
                      Icons.sensor_door_outlined,
                      size: 14,
                      color: Color(0xFF64748B),
                    ),
                    label: const Text(
                      'ເປີດລິ້ນຊັກ',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      minimumSize: Size.zero,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // 7. Action Footer: Cancel & Confirm
              Row(
                children: [
                  Expanded(
                    flex: 1,
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'ຍົກເລີກ',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed:
                          isCashSufficient
                              ? () => _onConfirmCheckout(context, grandTotal)
                              : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: const Color(0xFFE2E8F0),
                        disabledForegroundColor: const Color(0xFF94A3B8),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon:
                          printerState.isPrinting
                              ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                              : const Icon(Icons.check_rounded, size: 18),
                      label: Text(
                        printerState.isPrinting
                            ? 'ກຳລັງປະມວນຜົນ...'
                            : 'ຢືນຢັນ & ພິມໃບບິນ',
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ],
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
    required Color activeBg,
    required Color activeBorder,
    required Color activeText,
  }) {
    return InkWell(
      onTap: () {
        setState(() {
          _paymentMethod = method;
          if (method == PaymentMethod.cash) {
            _tenderedAmount = ref.read(cartProvider).grandTotal;
            _cashInputController.text = LaoCurrencyFormatter.formatDots(
              _tenderedAmount,
            );
          }
        });
      },
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: isSelected ? activeBg : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? activeBorder : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow:
              isSelected
                  ? [
                    BoxShadow(
                      color: activeBorder.withValues(alpha: 0.15),
                      offset: const Offset(0, 2),
                      blurRadius: 4,
                    ),
                  ]
                  : null,
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected ? activeText : const Color(0xFF64748B),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                color: isSelected ? activeText : const Color(0xFF64748B),
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCashSection(int grandTotal, int change) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'ຈຳນວນເງິນທີ່ໄດ້ຮັບ (₭):',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.bold,
                color: Color(0xFF334155),
              ),
            ),
            Text(
              '${LaoCurrencyFormatter.formatDots(_tenderedAmount)} ₭',
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F766E),
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: TextField(
            controller: _cashInputController,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0F172A),
              fontFamily: 'monospace',
            ),
            decoration: const InputDecoration(
              hintText: '0',
              suffixText: '₭',
              suffixStyle: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: Color(0xFF94A3B8),
              ),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 10,
              ),
            ),
            onChanged: (val) => _onCashInputChanged(val, grandTotal),
          ),
        ),
        const SizedBox(height: 8),

        // Fast Cash Chips: [Exact, 50k, 100k, 500k]
        Row(
          children:
              [grandTotal, 50000, 100000, 500000].map((amt) {
                final isChosen = _tenderedAmount == amt;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2.0),
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          _tenderedAmount = amt;
                          _cashInputController
                              .text = LaoCurrencyFormatter.formatDots(amt);
                        });
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color:
                              isChosen
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color:
                                isChosen
                                    ? const Color(0xFF0F766E)
                                    : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Text(
                          '${LaoCurrencyFormatter.formatDots(amt)} ₭',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                            color:
                                isChosen
                                    ? Colors.white
                                    : const Color(0xFF334155),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
        ),
        const SizedBox(height: 8),

        // Change Box
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFA7F3D0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ເງິນທອນ (Change):',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF065F46),
                ),
              ),
              Text(
                LaoCurrencyFormatter.format(change),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF065F46),
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTransferSection(int grandTotal) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F9FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBAE6FD)),
      ),
      child: Column(
        children: [
          Container(
            width: 120,
            height: 120,
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0D000000),
                  offset: Offset(0, 1),
                  blurRadius: 4,
                ),
              ],
            ),
            child: Image.asset(
              'public/qr.jpg',
              fit: BoxFit.contain,
              errorBuilder:
                  (_, __, ___) => Image.network(
                    'qr.jpg',
                    fit: BoxFit.contain,
                    errorBuilder:
                        (_, __, ___) => const Center(
                          child: Icon(
                            Icons.qr_code_2_rounded,
                            size: 80,
                            color: Color(0xFF0284C7),
                          ),
                        ),
                  ),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'ສະແກນ QR ຜ່ານແອັບ BCEL One / Lao QR',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0C4A6E),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'ຍອດໂອນ: ${LaoCurrencyFormatter.format(grandTotal)}',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0284C7),
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            '010-12-000-12345678-001 • ຮ້ານ MeiiShop',
            style: TextStyle(fontSize: 10, color: Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }

  Widget _buildDebtSection(int grandTotal, int remainingDebt) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2).withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFECDD3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    size: 16,
                    color: Color(0xFFF43F5E),
                  ),
                  SizedBox(width: 4),
                  Text(
                    'ຕັ້ງຄ່າການຄ້າງຊຳລະ (Credit Sale)',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color:
                      _debtPaidKip <= 0
                          ? const Color(0xFFFFE4E6)
                          : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color:
                        _debtPaidKip <= 0
                            ? const Color(0xFFFDA4AF)
                            : const Color(0xFFFDE68A),
                  ),
                ),
                child: Text(
                  _debtPaidKip <= 0 ? 'ຄ້າງຊຳລະ 100%' : 'ຈ່າຍກ່ອນບາງສ່ວນ',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.bold,
                    color:
                        _debtPaidKip <= 0
                            ? const Color(0xFFBE123C)
                            : const Color(0xFF92400E),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ຈຳນວນເງິນທີ່ຈ່າຍແລ້ວ / ຈ່າຍກ່ອນ (₭):',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF475569),
                ),
              ),
              Text(
                _debtPaidKip <= 0
                    ? 'ຍັງບໍ່ຈ່າຍ (0 ₭)'
                    : '${LaoCurrencyFormatter.formatDots(_debtPaidKip)} ₭',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                  color:
                      _debtPaidKip <= 0
                          ? const Color(0xFFE11D48)
                          : const Color(0xFF059669),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),

          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: _debtInputController,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
                fontFamily: 'monospace',
              ),
              decoration: const InputDecoration(
                hintText: '0 (ຫຼື ກົດເລືອກດ້ານລຸ່ມ)',
                hintStyle: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                suffixText: '₭',
                suffixStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF94A3B8),
                ),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
              ),
              onChanged: (val) => _onDebtInputChanged(val, grandTotal),
            ),
          ),
          const SizedBox(height: 6),

          // 2 Fast Debt Buttons: 100% (0 Kip) & 50%
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () {
                    setState(() {
                      _debtPaidKip = 0;
                      _debtInputController.clear();
                    });
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color:
                          _debtPaidKip == 0
                              ? const Color(0xFFF43F5E)
                              : Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color:
                            _debtPaidKip == 0
                                ? const Color(0xFFF43F5E)
                                : const Color(0xFFCBD5E1),
                      ),
                    ),
                    child: Text(
                      'ຄ້າງຊຳລະ 100% (0 ₭)',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.bold,
                        color:
                            _debtPaidKip == 0
                                ? Colors.white
                                : const Color(0xFF475569),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: InkWell(
                  onTap: () {
                    final half = (grandTotal / 2).round();
                    setState(() {
                      _debtPaidKip = half;
                      _debtInputController
                          .text = LaoCurrencyFormatter.formatDots(half);
                    });
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color:
                          _debtPaidKip == (grandTotal / 2).round() &&
                                  _debtPaidKip > 0
                              ? const Color(0xFFF59E0B)
                              : Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color:
                            _debtPaidKip == (grandTotal / 2).round() &&
                                    _debtPaidKip > 0
                                ? const Color(0xFFF59E0B)
                                : const Color(0xFFCBD5E1),
                      ),
                    ),
                    child: Text(
                      'ຈ່າຍກ່ອນ 50% (${LaoCurrencyFormatter.formatDots((grandTotal / 2).round())} ₭)',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.bold,
                        color:
                            _debtPaidKip == (grandTotal / 2).round() &&
                                    _debtPaidKip > 0
                                ? Colors.white
                                : const Color(0xFF475569),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Debt Balance Box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFFE4E6)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ຍອດຄ້າງຊຳລະ (DEBT BALANCE)',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF94A3B8),
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      _debtPaidKip > 0
                          ? 'ເຕັມ ${LaoCurrencyFormatter.formatDots(grandTotal)} ₭ - ຈ່າຍ ${LaoCurrencyFormatter.formatDots(_debtPaidKip)} ₭'
                          : 'ລູກຄ້າຄ້າງຊຳລະເຕັມຈຳນວນ 100%',
                      style: const TextStyle(
                        fontSize: 10,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
                Text(
                  LaoCurrencyFormatter.format(remainingDebt),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFE11D48),
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Debt Note
          const Text(
            'ໝາຍເຫດຄ້າງຊຳລະ / ວັນນັດຊຳລະ:',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Color(0xFF475569),
            ),
          ),
          const SizedBox(height: 4),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: _debtNoteController,
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF1E293B)),
              decoration: const InputDecoration(
                hintText:
                    'ເຊັ່ນ: ນັດຈ່າຍທ້າຍເດືອນ, ອ້າຍສົມສັກ 020 5555 1234...',
                hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _onConfirmCheckout(BuildContext context, int grandTotal) async {
    final customerName = _customerNameController.text.trim();
    final effectiveCustomer = customerName.isNotEmpty ? customerName : null;

    int tendered;
    int? paidAmount;
    int? debtAmount;
    String? debtStatus;
    String? debtNote;

    if (_paymentMethod == PaymentMethod.cash) {
      tendered = _tenderedAmount;
    } else if (_paymentMethod == PaymentMethod.qrTransfer) {
      tendered = grandTotal;
    } else {
      // Debt / Credit
      tendered = _debtPaidKip;
      paidAmount = _debtPaidKip;
      debtAmount =
          (grandTotal - _debtPaidKip) > 0 ? (grandTotal - _debtPaidKip) : 0;
      debtStatus =
          _debtPaidKip <= 0
              ? 'unpaid'
              : (_debtPaidKip >= grandTotal ? 'paid' : 'partial');
      debtNote =
          _debtNoteController.text.trim().isNotEmpty
              ? _debtNoteController.text.trim()
              : null;
    }

    final tx = await ref
        .read(transactionHistoryProvider.notifier)
        .processCheckout(
          paymentMethod: _paymentMethod,
          amountTendered: tendered,
          paidAmount: paidAmount,
          debtAmount: debtAmount,
          debtStatus: debtStatus,
          debtNote: debtNote,
          customerNameOverride: effectiveCustomer,
        );

    if (_shouldPrintReceipt) {
      await ref.read(printerProvider.notifier).printTransactionReceipt(tx);
    }

    setState(() {
      _completedTransaction = tx;
    });
  }

  Future<void> _handlePrintReceipt(
    BuildContext context,
    SaleTransaction tx,
  ) async {
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
    final isDebt = tx.isDebt || tx.paymentMethod == PaymentMethod.debt;
    final actualPaidAmount = tx.paidAmount > 0 ? tx.paidAmount : (isDebt ? 0 : tx.amountTendered);
    final remainingDebt = isDebt ? (tx.debtAmount > 0 ? tx.debtAmount : (tx.grandTotal - actualPaidAmount)) : 0;
    final changeBreakdown =
        isCash && tx.changeAmount > 0
            ? LaoCurrencyFormatter.breakdownChange(tx.changeAmount)
            : <int, int>{};
    final screenSize = MediaQuery.of(context).size;
    final isCompactLandscape = screenSize.height < 500;

    return Dialog(
      insetPadding: EdgeInsets.symmetric(
        horizontal: isCompactLandscape ? 12 : 32,
        vertical: isCompactLandscape ? 8 : 24,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 880,
          maxHeight: isCompactLandscape ? (screenSize.height - 16) : 760,
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 640;

            if (isWide) {
              return Padding(
                padding: EdgeInsets.all(isCompactLandscape ? 12.0 : 24.0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Left Column (42%): Outcomes & Actions
                    Expanded(
                      flex: isCompactLandscape ? 45 : 40,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Scrollable Details Section
                          Expanded(
                            child: SingleChildScrollView(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  // Success Icon & Header
                                  Row(
                                    children: [
                                      Container(
                                        width: isCompactLandscape ? 36 : 48,
                                        height: isCompactLandscape ? 36 : 48,
                                        decoration: BoxDecoration(
                                          color: AppColors.primaryLight,
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: AppColors.primary.withValues(
                                              alpha: 0.3,
                                            ),
                                          ),
                                        ),
                                        child: Icon(
                                          Icons.check_circle_rounded,
                                          size: isCompactLandscape ? 22 : 28,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'ຊຳລະເງິນສຳເລັດແລ້ວ!',
                                              style: TextStyle(
                                                fontSize:
                                                    isCompactLandscape
                                                        ? 15
                                                        : 18,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            Text(
                                              'ບັນທຶກລາຍການ ແລະ ຕັດສາງຮຽບຮ້ອຍ',
                                              style: TextStyle(
                                                fontSize:
                                                    isCompactLandscape
                                                        ? 11
                                                        : 12,
                                                color: AppColors.textSecondary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),

                                  SizedBox(height: isCompactLandscape ? 8 : 16),

                                  // If Debt > 0, Big Eye-catching Amber Banner
                                  if (tx.isDebt || tx.paymentMethod == PaymentMethod.debt) ...[
                                    Container(
                                      padding: EdgeInsets.all(
                                        isCompactLandscape ? 8 : 14,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF3C7).withValues(alpha: 0.8),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: const Color(0xFFFCD34D),
                                          width: 1.2,
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Row(
                                            children: [
                                              Icon(
                                                Icons.warning_amber_rounded,
                                                color: Color(0xFFB45309),
                                                size: 16,
                                              ),
                                              SizedBox(width: 6),
                                              Text(
                                                'ຍອດຄ້າງຊຳລະ (Debt Balance):',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF92400E),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            LaoCurrencyFormatter.format(tx.debtAmount),
                                            style: TextStyle(
                                              fontSize: isCompactLandscape ? 20 : 24,
                                              fontWeight: FontWeight.w900,
                                              color: const Color(0xFFB91C1C),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    SizedBox(height: isCompactLandscape ? 6 : 12),
                                  ],

                                  // If Change Due > 0, Big Eye-catching Banner
                                  if (isCash && tx.changeAmount > 0) ...[
                                    Container(
                                      padding: EdgeInsets.all(
                                        isCompactLandscape ? 8 : 14,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF0FDF4),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: const Color(0xFF86EFAC),
                                          width: 1.2,
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Row(
                                            children: [
                                              Icon(
                                                Icons.paid_outlined,
                                                color: AppColors.primaryDark,
                                                size: 16,
                                              ),
                                              SizedBox(width: 6),
                                              Text(
                                                'ເງິນທອນລູກຄ້າ (Change Due):',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.primaryDark,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            LaoCurrencyFormatter.format(
                                              tx.changeAmount,
                                            ),
                                            style: TextStyle(
                                              fontSize:
                                                  isCompactLandscape ? 20 : 24,
                                              fontWeight: FontWeight.w900,
                                              color: AppColors.primaryDark,
                                            ),
                                          ),
                                          if (changeBreakdown.isNotEmpty) ...[
                                            const SizedBox(height: 6),
                                            const Text(
                                              'ໃບເງິນທີ່ຕ້ອງທອນ (Banknotes):',
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF166534),
                                              ),
                                            ),
                                            const SizedBox(height: 3),
                                            Wrap(
                                              spacing: 5,
                                              runSpacing: 4,
                                              children:
                                                  changeBreakdown.entries.map((
                                                    e,
                                                  ) {
                                                    return Container(
                                                      padding:
                                                          const EdgeInsets.symmetric(
                                                            horizontal: 6,
                                                            vertical: 2,
                                                          ),
                                                      decoration: BoxDecoration(
                                                        color: Colors.white,
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              5,
                                                            ),
                                                        border: Border.all(
                                                          color: const Color(
                                                            0xFFBBF7D0,
                                                          ),
                                                        ),
                                                      ),
                                                      child: Text(
                                                        '${LaoCurrencyFormatter.format(e.key)} × ${e.value}',
                                                        style: const TextStyle(
                                                          fontSize: 10.5,
                                                          fontWeight:
                                                              FontWeight.w800,
                                                          color: Color(
                                                            0xFF166534,
                                                          ),
                                                        ),
                                                      ),
                                                    );
                                                  }).toList(),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    SizedBox(
                                      height: isCompactLandscape ? 6 : 12,
                                    ),
                                  ],

                                  // Summary Box
                                  Container(
                                    padding: EdgeInsets.all(
                                      isCompactLandscape ? 8 : 14,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceSubtle,
                                      borderRadius: BorderRadius.circular(9),
                                      border: Border.all(
                                        color: AppColors.border,
                                      ),
                                    ),
                                    child: Column(
                                      children: [
                                        _buildSummaryRow(
                                          'ເລກທີບິນ:',
                                          tx.receiptNumber,
                                          isBold: true,
                                          isCompact: isCompactLandscape,
                                        ),
                                        SizedBox(
                                          height: isCompactLandscape ? 4 : 6,
                                        ),
                                        _buildSummaryRow(
                                          'ຍອດຂາຍລວມ:',
                                          LaoCurrencyFormatter.format(
                                            tx.grandTotal,
                                          ),
                                          isBold: true,
                                          isCompact: isCompactLandscape,
                                        ),
                                        SizedBox(
                                          height: isCompactLandscape ? 4 : 6,
                                        ),
                                        _buildSummaryRow(
                                          isDebt
                                              ? 'ຈ່າຍກ່ອນ (Paid):'
                                              : (isCash
                                                  ? 'ຮັບເງິນສົດມາ:'
                                                  : 'ຮັບເງິນໂອນມາ:'),
                                          LaoCurrencyFormatter.format(
                                            isDebt ? actualPaidAmount : tx.amountTendered,
                                          ),
                                          isCompact: isCompactLandscape,
                                        ),
                                        if (isDebt && remainingDebt > 0) ...[
                                          SizedBox(
                                            height: isCompactLandscape ? 4 : 6,
                                          ),
                                          _buildSummaryRow(
                                            'ຍອດຄ້າງຊຳລະ:',
                                            LaoCurrencyFormatter.format(remainingDebt),
                                            color: const Color(0xFFDC2626),
                                            isBold: true,
                                            isCompact: isCompactLandscape,
                                          ),
                                        ],
                                        SizedBox(
                                          height: isCompactLandscape ? 4 : 6,
                                        ),
                                        _buildSummaryRow(
                                          'ວິທີຊຳລະ:',
                                          isDebt
                                              ? 'ຕິດໜີ້ (Debt / Credit)'
                                              : (isCash
                                                  ? 'ເງິນສົດ (Cash)'
                                                  : 'QR ໂອນ (BCEL One)'),
                                          isCompact: isCompactLandscape,
                                        ),
                                        SizedBox(
                                          height: isCompactLandscape ? 4 : 6,
                                        ),
                                        _buildSummaryRow(
                                          'ລູກຄ້າ:',
                                          tx.customer.name,
                                          isCompact: isCompactLandscape,
                                        ),
                                        Divider(
                                          height: isCompactLandscape ? 10 : 16,
                                        ),
                                        _buildSummaryRow(
                                          'ກຳໄລຂັ້ນຕົ້ນ:',
                                          '+${LaoCurrencyFormatter.format(tx.grossProfit)}',
                                          color: AppColors.primaryDark,
                                          isCompact: isCompactLandscape,
                                        ),
                                      ],
                                    ),
                                  ),

                                  SizedBox(height: isCompactLandscape ? 6 : 12),

                                  // Notice regarding no physical printer
                                  Container(
                                    padding: EdgeInsets.all(
                                      isCompactLandscape ? 7 : 10,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryLight.withValues(
                                        alpha: 0.35,
                                      ),
                                      borderRadius: BorderRadius.circular(7),
                                      border: Border.all(
                                        color: AppColors.primary.withValues(
                                          alpha: 0.3,
                                        ),
                                      ),
                                    ),
                                    child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Icon(
                                          Icons.info_outline,
                                          size: isCompactLandscape ? 14 : 16,
                                          color: AppColors.primaryDark,
                                        ),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            'ບໍ່ທັນມີເຄື່ອງພິມບິນ? ທ່ານສາມາດກວດເບິ່ງໃບບິນດິຈິຕອນຂ້າງໆນີ້ ຫຼື ກົດປຸ່ມ "ພິມໃບບິນ" ເພື່ອພິມຜ່ານ Browser / Save ເປັນ PDF ໄດ້.',
                                            style: TextStyle(
                                              fontSize:
                                                  isCompactLandscape ? 9.5 : 11,
                                              color: AppColors.primaryDark,
                                              height: 1.3,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 8),

                          // Actions: Side-by-side on compact landscape, stacked on large screens
                          if (isCompactLandscape)
                            Row(
                              children: [
                                Expanded(
                                  flex: 4,
                                  child: OutlinedButton.icon(
                                    onPressed:
                                        () => Navigator.of(context).pop(),
                                    icon: const Icon(
                                      Icons.add_shopping_cart_rounded,
                                      size: 15,
                                    ),
                                    label: const FittedBox(
                                      fit: BoxFit.scaleDown,
                                      child: Text(
                                        'ເລີ່ມບິນໃໝ່',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                    style: OutlinedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 9,
                                        horizontal: 6,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 6,
                                  child: ElevatedButton.icon(
                                    onPressed:
                                        () => _handlePrintReceipt(context, tx),
                                    icon: const Icon(
                                      Icons.print_rounded,
                                      size: 16,
                                    ),
                                    label: const FittedBox(
                                      fit: BoxFit.scaleDown,
                                      child: Text(
                                        'ພິມໃບບິນ (Print)',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12.5,
                                        ),
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 9,
                                        horizontal: 6,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            )
                          else ...[
                            ElevatedButton.icon(
                              onPressed: () => _handlePrintReceipt(context, tx),
                              icon: const Icon(Icons.print_rounded, size: 20),
                              label: const Text(
                                'ພິມໃບບິນ (Print Receipt)',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: () => Navigator.of(context).pop(),
                              icon: const Icon(
                                Icons.add_shopping_cart_rounded,
                                size: 18,
                              ),
                              label: const Text(
                                'ເລີ່ມບິນໃໝ່ (New Sale)',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ],
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
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.vertical(
                                  top: Radius.circular(11),
                                ),
                                border: Border(
                                  bottom: BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Row(
                                    children: [
                                      Icon(
                                        Icons.receipt_long_rounded,
                                        size: 18,
                                        color: AppColors.primary,
                                      ),
                                      SizedBox(width: 8),
                                      Text(
                                        'ໃບບິນດິຈິຕອນ (Digital Receipt Preview)',
                                        style: TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  IconButton(
                                    tooltip: 'ພິມໃບບິນ',
                                    icon: const Icon(
                                      Icons.print_outlined,
                                      size: 20,
                                      color: AppColors.primary,
                                    ),
                                    onPressed:
                                        () => _handlePrintReceipt(context, tx),
                                  ),
                                ],
                              ),
                            ),
                            // Scrollable Receipt Slip (Captured for print)
                            Expanded(
                              child: SingleChildScrollView(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 16,
                                ),
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
                      const Icon(
                        Icons.check_circle_rounded,
                        size: 28,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'ຊຳລະເງິນສຳເລັດ!',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close),
                      ),
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
                          const Text(
                            'ເງິນທອນ:',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            LaoCurrencyFormatter.format(tx.changeAmount),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: AppColors.primaryDark,
                            ),
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

  Widget _buildSummaryRow(
    String label,
    String value, {
    bool isBold = false,
    Color? color,
    bool isCompact = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: isCompact ? 11 : 13,
            fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isCompact ? 12 : 14,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: color ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
