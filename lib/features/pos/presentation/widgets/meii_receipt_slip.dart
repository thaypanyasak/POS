import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:screenshot/screenshot.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/utils/platform_print.dart';
import '../../../../domain/models/sale_transaction.dart';

/// Modal dialog helper to view and print any MeiiShop receipt
Future<void> showMeiiReceiptDialog(
  BuildContext context,
  SaleTransaction transaction, {
  VoidCallback? onPrint,
}) {
  final ScreenshotController dialogScreenshot = ScreenshotController();

  return showDialog(
    context: context,
    builder: (ctx) {
      int paperWidth = 80; // Default 80mm thermal roll

      return StatefulBuilder(
        builder: (context, setModalState) {
          final slipWidth = paperWidth == 80 ? 440.0 : 330.0;

          return Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            backgroundColor: Colors.transparent,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520, maxHeight: 820),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 24,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Top Action Toolbar
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.vertical(
                          top: Radius.circular(16),
                        ),
                        border: Border(
                          bottom: BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(
                                Icons.receipt_long,
                                color: AppColors.primary,
                                size: 20,
                              ),
                              SizedBox(width: 8),
                              Text(
                                'ໃບບິນ MeiiShop',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              // 80mm vs 58mm Paper Roll Toggle
                              Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFCBD5E1)),
                                ),
                                child: Row(
                                  children: [
                                    InkWell(
                                      onTap: () => setModalState(() => paperWidth = 80),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: paperWidth == 80 ? AppColors.primary : Colors.transparent,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          '80mm',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: paperWidth == 80 ? Colors.white : AppColors.textSecondary,
                                          ),
                                        ),
                                      ),
                                    ),
                                    InkWell(
                                      onTap: () => setModalState(() => paperWidth = 58),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: paperWidth == 58 ? AppColors.primary : Colors.transparent,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          '58mm',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: paperWidth == 58 ? Colors.white : AppColors.textSecondary,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton.icon(
                                onPressed: () async {
                                  try {
                                    final bytes = await dialogScreenshot.capture(
                                      pixelRatio: 2.5,
                                    );
                                    if (bytes != null && bytes.isNotEmpty) {
                                      final uri =
                                          'data:image/png;base64,${base64Encode(bytes)}';
                                      triggerPlatformPrintReceipt(
                                        uri,
                                        paperWidthMm: paperWidth,
                                      );
                                    } else {
                                      triggerPlatformPrint();
                                    }
                                  } catch (_) {
                                    triggerPlatformPrint();
                                  }
                                  if (onPrint != null) {
                                    onPrint();
                                  }
                                },
                                icon: const Icon(Icons.print, size: 16),
                                label: Text('ພິມ (${paperWidth}mm)'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 8,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              IconButton(
                                icon: const Icon(Icons.close),
                                onPressed: () => Navigator.of(ctx).pop(),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Scrollable Realistic Receipt Slip
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                        child: Center(
                          child: Container(
                            decoration: const BoxDecoration(
                              boxShadow: [
                                BoxShadow(
                                  color: Color(0x18000000),
                                  offset: Offset(0, 10),
                                  blurRadius: 24,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                            child: Screenshot(
                              controller: dialogScreenshot,
                              child: MeiiReceiptSlip(
                                transaction: transaction,
                                width: slipWidth,
                                showShadow: false,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    },
  );
}

/// Authentic High-Fidelity Lao Thermal Receipt Component
///
/// Specifically tailored for **MeiiShop** (ຮ້ານ MeiiShop):
/// - Realistic paper presentation with soft dropshadow and perforated/jagged cut edges
/// - Clear typography using Noto Sans Lao with expanded line height for tone marks
/// - Itemized table displaying units dynamically (ແພັກ, ແກັດ, ລັງ 24 ແກ້ວ)
/// - Proper Kip currency formatting with dot separators (`500.000 ₭`, `70.000 ₭`)
/// - Simulated thermal barcode and cordial store gratitude message
class MeiiReceiptSlip extends StatelessWidget {
  final SaleTransaction transaction;
  final double width;
  final bool showShadow;

  const MeiiReceiptSlip({
    super.key,
    required this.transaction,
    this.width = 440.0,
    this.showShadow = false,
  });

  static TextStyle _style({
    required double fontSize,
    FontWeight fontWeight = FontWeight.normal,
    Color color = const Color(0xFF1E293B),
    double height = 1.4,
  }) {
    return GoogleFonts.notoSansLao(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy');
    final timeFormat = DateFormat('HH:mm:ss');

    return Center(
      child: Container(
        width: width,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(2),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
          boxShadow: showShadow
              ? const [
                  BoxShadow(
                    color: Color(0x12000000),
                    offset: Offset(0, 8),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Jagged / Perforated Paper Edge
            const _ReceiptJaggedEdge(isTop: true),

            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 16.0,
                vertical: 14.0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Store Logo Badge
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'MeiiShop',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Store Titles
                  Text(
                    'ຮ້ານ MeiiShop',
                    style: _style(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ',
                    style: _style(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF64748B),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    'ຖະໜົນ ໄກສອນ ພົມວິຫານ, ບ້ານ ໂພນສະຫວ່າງ, ນະຄອນຫຼວງວຽງຈັນ',
                    style: _style(
                      fontSize: 10.5,
                      color: const Color(0xFF64748B),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    'ໂທ: 020 5555 9999 / 021 214 555',
                    style: _style(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF475569),
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 12),

                  // Receipt Header Banner
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    decoration: const BoxDecoration(
                      border: Border.symmetric(
                        horizontal: BorderSide(
                          color: Color(0xFF0F172A),
                          width: 1.2,
                        ),
                      ),
                    ),
                    child: Text(
                      'ໃບບິນຮັບເງິນ / RECEIPT',
                      style: _style(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Metadata Info
                  _buildMetaLine(
                    'ເລກທີບິນ:',
                    transaction.receiptNumber,
                    isBold: true,
                  ),
                  _buildMetaLine(
                    'ວັນທີ & ເວລາ:',
                    '${dateFormat.format(transaction.createdAt)} ${timeFormat.format(transaction.createdAt)}',
                  ),
                  _buildMetaLine(
                    'ພະນັກງານຂາຍ:',
                    transaction.cashierName ?? 'Meii',
                  ),
                  _buildMetaLine(
                    'ລູກຄ້າ:',
                    '${transaction.customer.name} (${transaction.isWholesale ? 'ຂາຍສົ່ງ' : 'ຂາຍຍ່ອຍ'})',
                  ),
                  _buildMetaLine(
                    'ຮູບແບບຊຳລະ:',
                    transaction.paymentMethod == PaymentMethod.cash
                        ? 'ເງິນສົດ (Cash)'
                        : 'QR ໂອນ (BCEL One)',
                    valueColor:
                        transaction.paymentMethod == PaymentMethod.cash
                            ? AppColors.primaryDark
                            : AppColors.wholesaleDark,
                    isBold: true,
                  ),

                  const SizedBox(height: 10),
                  _buildDashedLine(),
                  const SizedBox(height: 8),

                  // Table Columns Header
                  Row(
                    children: [
                      Expanded(
                        flex: 5,
                        child: Text(
                          'ລາຍການສິນຄ້າ',
                          style: _style(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF334155),
                          ),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          'ຈຳນວນ x ລາຄາ',
                          style: _style(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF334155),
                          ),
                          textAlign: TextAlign.right,
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          'ລວມ (₭)',
                          style: _style(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF334155),
                          ),
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 4),
                  const Divider(
                    color: Color(0xFFCBD5E1),
                    height: 1,
                    thickness: 1,
                  ),
                  const SizedBox(height: 6),

                  // Items List
                  ...transaction.items.map((item) {
                    final unitName = item.selectedUnit.unitName;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3.5),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            item.product.name,
                            style: _style(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 1),
                          Row(
                            children: [
                              Expanded(
                                flex: 5,
                                child: Text(
                                  '  ${item.quantity} $unitName',
                                  style: _style(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF475569),
                                  ),
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  '@ ${LaoCurrencyFormatter.format(item.effectiveUnitPrice, includeSymbol: false)}',
                                  style: _style(
                                    fontSize: 11.5,
                                    color: const Color(0xFF475569),
                                  ),
                                  textAlign: TextAlign.right,
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  LaoCurrencyFormatter.format(
                                    item.lineTotal,
                                    includeSymbol: false,
                                  ),
                                  style: _style(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF0F172A),
                                  ),
                                  textAlign: TextAlign.right,
                                ),
                              ),
                            ],
                          ),
                          if (item.isPriceOverridden) ...[
                            Padding(
                              padding: const EdgeInsets.only(left: 10, top: 1),
                              child: Text(
                                '* ລາຄາພິເສດ (ເດີມ: ${LaoCurrencyFormatter.format(item.originalUnitPrice)})',
                                style: _style(
                                  fontSize: 10,
                                  color: AppColors.wholesaleDark,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  }),

                  const SizedBox(height: 8),
                  _buildDashedLine(),
                  const SizedBox(height: 8),

                  // Summary Totals
                  _buildTotalLine(
                    'ລວມເງິນສິນຄ້າ (Subtotal):',
                    LaoCurrencyFormatter.format(transaction.subtotal),
                  ),
                  if (transaction.discountTotal > 0) ...[
                    _buildTotalLine(
                      'ສ່ວນຫຼຸດ (Discount):',
                      '-${LaoCurrencyFormatter.format(transaction.discountTotal)}',
                      valueColor: AppColors.error,
                      isBold: true,
                    ),
                  ],

                  const SizedBox(height: 6),
                  const Divider(
                    color: Color(0xFF0F172A),
                    height: 1.5,
                    thickness: 1.5,
                  ),
                  const SizedBox(height: 6),

                  // GRAND TOTAL
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'ຍອດຊຳລະສຸດທິ:',
                        style: _style(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        LaoCurrencyFormatter.format(transaction.grandTotal),
                        style: _style(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primaryDark,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 6),
                  const Divider(
                    color: Color(0xFF0F172A),
                    height: 1.5,
                    thickness: 1.5,
                  ),
                  const SizedBox(height: 8),

                  // Payment Tender Details
                  _buildTotalLine(
                    transaction.paymentMethod == PaymentMethod.cash
                        ? 'ຮັບເງິນສົດມາ (Tendered):'
                        : 'ຮັບເງິນໂອນມາ (Transferred):',
                    LaoCurrencyFormatter.format(transaction.amountTendered),
                    isBold: true,
                  ),
                  if (transaction.paymentMethod == PaymentMethod.cash) ...[
                    _buildTotalLine(
                      'ເງິນທອນ (Change):',
                      LaoCurrencyFormatter.format(transaction.changeAmount),
                      isBold: true,
                      valueColor:
                          transaction.changeAmount > 0
                              ? AppColors.primaryDark
                              : const Color(0xFF64748B),
                      fontSize: 13.5,
                    ),
                  ],

                  // If QR Transfer Payment, show QR code image at bottom of receipt
                  if (transaction.paymentMethod ==
                      PaymentMethod.qrTransfer) ...[
                    const SizedBox(height: 10),
                    _buildQrCodeSection(),
                  ],

                  const SizedBox(height: 12),
                  _buildDashedLine(),
                  const SizedBox(height: 12),

                  // Receiver & Cashier Signature Section (ບ່ອນວ່າງ "ຜູ້ຮັບ" ເພື່ອໃຫ້ລູກຄ້າເຊັນຮັບເຄື່ອງ)
                  _buildSignatureSection(),

                  const SizedBox(height: 10),
                  _buildDashedLine(),
                  const SizedBox(height: 12),

                  // Simulated Barcode
                  Center(
                    child: Column(
                      children: [
                        const _SimulatedBarcode(width: 220, height: 36),
                        const SizedBox(height: 4),
                        Text(
                          transaction.receiptNumber,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            letterSpacing: 2.0,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Receipt Footer & Store Messages
                  Center(
                    child: Column(
                      children: [
                        Text(
                          '*** ຂອບໃຈທີ່ມາອຸດໜູນ ຮ້ານ MeiiShop ***',
                          style: _style(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'THANK YOU FOR SHOPPING WITH US',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'ໂອກາດໜ້າຍິນດີຕ້ອນຮັບໃໝ່',
                          style: _style(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF475569),
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '(ສິນຄ້າຊື້ແລ້ວ ບໍ່ຮັບປ່ຽນ ຫຼື ຄືນ)',
                          style: _style(
                            fontSize: 10,
                            color: const Color(0xFF94A3B8),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Bottom Jagged / Perforated Paper Edge
            const _ReceiptJaggedEdge(isTop: false),
          ],
        ),
      ),
    );
  }

  Widget _buildQrCodeSection() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.qr_code_scanner,
                size: 16,
                color: AppColors.wholesaleDark,
              ),
              const SizedBox(width: 6),
              Text(
                'ສະແກນ QR ເພື່ອຊຳລະເງິນ (BCEL One / Lao QR)',
                style: _style(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Image.asset(
              'public/qr.jpg',
              width: 140,
              height: 140,
              fit: BoxFit.contain,
              errorBuilder:
                  (_, __, ___) => Image.network(
                    'qr.jpg',
                    width: 140,
                    height: 140,
                    fit: BoxFit.contain,
                    errorBuilder:
                        (_, __, ___) => Container(
                          width: 140,
                          height: 140,
                          color: Colors.white,
                          child: const Center(
                            child: Icon(
                              Icons.qr_code_2,
                              size: 80,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                  ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'ຍອດໂອນ: ${LaoCurrencyFormatter.format(transaction.grandTotal)}',
            style: _style(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: AppColors.wholesaleDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'ກະລຸນາກວດສອບຍອດເງິນ ແລະ ຊື່ບັນຊີກ່ອນໂອນ',
            style: _style(fontSize: 9.5, color: const Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }

  Widget _buildSignatureSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Cashier / ຜູ້ຂາຍ
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 38), // Blank space for sign
                Container(
                  width: 110,
                  height: 1,
                  color: const Color(0xFF94A3B8),
                ),
                const SizedBox(height: 4),
                Text(
                  'ຜູ້ຂາຍ (Cashier)',
                  style: _style(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF475569),
                  ),
                ),
                Text(
                  '(${transaction.cashierName ?? 'ໄມ້ຄຳ'})',
                  style: _style(fontSize: 10, color: const Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Receiver / ຜູ້ຮັບ (ລູກຄ້າເຊັນຮັບເຄື່ອງ)
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(
                  height: 38,
                ), // Blank space for customer signature
                Container(
                  width: 130,
                  height: 1.2,
                  color: const Color(0xFF0F172A),
                ),
                const SizedBox(height: 4),
                Text(
                  'ຜູ້ຮັບ (Receiver)',
                  style: _style(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                Text(
                  '(${transaction.customer.name})',
                  style: _style(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                Text(
                  '(ລູກຄ້າເຊັນຮັບເຄື່ອງ)',
                  style: _style(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetaLine(
    String label,
    String value, {
    bool isBold = false,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: _style(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: _style(
              fontSize: 11.5,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              color: valueColor ?? const Color(0xFF1E293B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalLine(
    String label,
    String value, {
    bool isBold = false,
    Color? valueColor,
    double fontSize = 12.5,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: _style(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              color: const Color(0xFF334155),
            ),
          ),
          Text(
            value,
            style: _style(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w600,
              color: valueColor ?? const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashedLine() {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 4.0;
        const dashSpace = 3.0;
        final dashCount =
            (constraints.maxWidth / (dashWidth + dashSpace)).floor();
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(dashCount, (_) {
            return const SizedBox(
              width: dashWidth,
              height: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(color: Color(0xFF94A3B8)),
              ),
            );
          }),
        );
      },
    );
  }
}

/// Simulated Barcode Graphic (Clean monochrome thermal printer style)
class _SimulatedBarcode extends StatelessWidget {
  final double width;
  final double height;

  const _SimulatedBarcode({required this.width, required this.height});

  @override
  Widget build(BuildContext context) {
    const barWidths = [
      2,
      1,
      3,
      1,
      2,
      4,
      1,
      2,
      1,
      3,
      2,
      1,
      4,
      1,
      2,
      1,
      3,
      2,
      1,
      2,
      4,
      1,
      3,
      1,
      2,
      1,
      4,
      2,
      1,
      3,
      1,
      2,
      1,
      4,
      2,
      1,
      3,
      2,
      1,
      4,
      1,
      2,
      1,
      3,
      2,
      1,
      2,
      4,
    ];

    return SizedBox(
      width: width,
      height: height,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children:
            barWidths.map((w) {
              final isBlack = w % 2 != 0;
              return Container(
                width: w.toDouble() * 0.9,
                height: height,
                color: isBlack ? const Color(0xFF0F172A) : Colors.transparent,
              );
            }).toList(),
      ),
    );
  }
}

/// Jagged / Sawtooth thermal paper edge cut effect
class _ReceiptJaggedEdge extends StatelessWidget {
  final bool isTop;

  const _ReceiptJaggedEdge({required this.isTop});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 8,
      child: CustomPaint(
        painter: _JaggedEdgePainter(isTop: isTop),
        child: const SizedBox.expand(),
      ),
    );
  }
}

class _JaggedEdgePainter extends CustomPainter {
  final bool isTop;

  const _JaggedEdgePainter({required this.isTop});

  @override
  void paint(Canvas canvas, Size size) {
    final paint =
        Paint()
          ..color = const Color(0xFFF1F5F9)
          ..style = PaintingStyle.fill;

    final path = Path();
    const toothWidth = 8.0;
    final teethCount = (size.width / toothWidth).ceil();

    if (isTop) {
      path.moveTo(0, 0);
      for (int i = 0; i < teethCount; i++) {
        final x = i * toothWidth;
        path.lineTo(x + toothWidth / 2, size.height);
        path.lineTo(x + toothWidth, 0);
      }
      path.lineTo(size.width, 0);
      path.close();
    } else {
      path.moveTo(0, size.height);
      for (int i = 0; i < teethCount; i++) {
        final x = i * toothWidth;
        path.lineTo(x + toothWidth / 2, 0);
        path.lineTo(x + toothWidth, size.height);
      }
      path.lineTo(size.width, size.height);
      path.close();
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
