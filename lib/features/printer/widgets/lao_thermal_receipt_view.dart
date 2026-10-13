import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../core/localization/lo.dart';
import '../../../domain/models/sale_transaction.dart';

/// Lao Thermal Receipt Widget formatted strictly for 80mm (576 dots) Thermal Printers.
/// Uses Noto Sans Lao with expanded line-height so Lao vowels/tone marks render cleanly without clipping.
class LaoThermalReceiptView extends StatelessWidget {
  final SaleTransaction transaction;
  final double
  receiptWidth; // Typically 576.0 for 80mm printer or 384.0 for 58mm

  const LaoThermalReceiptView({
    super.key,
    required this.transaction,
    this.receiptWidth = 576.0,
  });

  static TextStyle _receiptStyle({
    required double fontSize,
    FontWeight fontWeight = FontWeight.normal,
  }) {
    return GoogleFonts.notoSansLao(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: Colors.black,
      height: 1.45,
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy');
    final timeFormat = DateFormat('HH:mm:ss');

    return Container(
      width: receiptWidth,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Store Header
          Text(
            LaoStrings.storeName,
            style: _receiptStyle(fontSize: 22, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            LaoStrings.storeSubtitle,
            style: _receiptStyle(fontSize: 14, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 2),
          Text(
            LaoStrings.storeAddress,
            style: _receiptStyle(fontSize: 12),
            textAlign: TextAlign.center,
          ),
          Text(
            LaoStrings.storeTel,
            style: _receiptStyle(fontSize: 12),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 12),
          _buildDashedLine(),
          const SizedBox(height: 8),

          // Receipt Metadata
          _buildMetaRow(
            '${LaoStrings.receiptNo}:',
            transaction.receiptNumber,
            isBold: true,
          ),
          _buildMetaRow(
            '${LaoStrings.date}:',
            '${dateFormat.format(transaction.createdAt)} ${timeFormat.format(transaction.createdAt)}',
          ),
          _buildMetaRow(
            '${LaoStrings.cashier}:',
            transaction.cashierName ?? 'Meii',
          ),
          _buildMetaRow(
            '${LaoStrings.customer}:',
            '${transaction.customer.name} (${transaction.isWholesale ? LaoStrings.wholesale : LaoStrings.retail})',
          ),

          const SizedBox(height: 8),
          _buildDashedLine(),
          const SizedBox(height: 8),

          // Items Header
          Row(
            children: [
              Expanded(
                flex: 5,
                child: Text(
                  'ລາຍການສິນຄ້າ',
                  style: _receiptStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Expanded(
                flex: 3,
                child: Text(
                  'ຈຳນວນ x ລາຄາ',
                  style: _receiptStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.right,
                ),
              ),
              Expanded(
                flex: 3,
                child: Text(
                  'ລວມ (₭)',
                  style: _receiptStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),
          const Divider(color: Colors.black, thickness: 1, height: 1),
          const SizedBox(height: 6),

          // Items List
          ...transaction.items.map((item) {
            final unitText = item.selectedUnit.unitName;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Item Name
                  Text(
                    item.product.name,
                    style: _receiptStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  // Item breakdown
                  Row(
                    children: [
                      Expanded(
                        flex: 5,
                        child: Text(
                          '  ${item.quantity} $unitText',
                          style: _receiptStyle(fontSize: 13),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          '@ ${LaoCurrencyFormatter.format(item.effectiveUnitPrice, includeSymbol: false)}',
                          style: _receiptStyle(fontSize: 13),
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
                          style: _receiptStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                  // Price override notice if applicable
                  if (item.isPriceOverridden)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 2),
                      child: Text(
                        '  * ລາຄາພິເສດ (ເດີມ: ${LaoCurrencyFormatter.format(item.originalUnitPrice, includeSymbol: false)})',
                        style: _receiptStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
            );
          }),

          const SizedBox(height: 8),
          _buildDashedLine(),
          const SizedBox(height: 8),

          // Totals
          _buildTotalRow(
            '${LaoStrings.subtotal}:',
            LaoCurrencyFormatter.format(transaction.subtotal),
          ),
          if (transaction.discountTotal > 0)
            _buildTotalRow(
              '${LaoStrings.discount}:',
              '-${LaoCurrencyFormatter.format(transaction.discountTotal)}',
            ),
          const SizedBox(height: 4),
          _buildTotalRow(
            '${LaoStrings.total}:',
            LaoCurrencyFormatter.format(transaction.grandTotal),
            fontSize: 20,
            isBold: true,
          ),

          const SizedBox(height: 8),
          _buildDashedLine(),
          const SizedBox(height: 8),

          // Payment Tender
          _buildTotalRow(
            transaction.paymentMethod == PaymentMethod.cash
                ? '${LaoStrings.cash}:'
                : '${LaoStrings.transfer}:',
            LaoCurrencyFormatter.format(transaction.amountTendered),
          ),
          if (transaction.paymentMethod == PaymentMethod.cash)
            _buildTotalRow(
              '${LaoStrings.change}:',
              LaoCurrencyFormatter.format(transaction.changeAmount),
              isBold: true,
            ),

          const SizedBox(height: 16),

          // Receipt Footer
          Center(
            child: Column(
              children: [
                Text(
                  LaoStrings.thankYouMsg,
                  style: _receiptStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  LaoStrings.welcomeBackMsg,
                  style: _receiptStyle(fontSize: 13),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'ສິນຄ້າຊື້ແລ້ວ ບໍ່ຮັບປ່ຽນ ຫຼື ຄືນ',
                  style: _receiptStyle(fontSize: 11),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                // Visual cut line guide
                Text(
                  '- - - - - - - - - - - - - - - - - - - - - - - -',
                  style: _receiptStyle(fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashedLine() {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 5.0;
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
                decoration: BoxDecoration(color: Colors.black),
              ),
            );
          }),
        );
      },
    );
  }

  Widget _buildMetaRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: _receiptStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          Text(
            value,
            style: _receiptStyle(
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalRow(
    String label,
    String value, {
    double fontSize = 14,
    bool isBold = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: _receiptStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            ),
          ),
          Text(
            value,
            style: _receiptStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
