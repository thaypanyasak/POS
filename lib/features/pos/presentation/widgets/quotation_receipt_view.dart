import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../domain/models/cart_item.dart';

/// Authentic Quotation / Proforma Receipt Slip formatted strictly for 80mm & 58mm POS thermal printers.
///
/// Features:
/// - Prominent notice: *** ໃບນີ້ບໍ່ແມ່ນໃບບິນຮັບເງິນ / NOT A RECEIPT ***
/// - Itemized list with units and price breakdown
/// - Removes tendered amount, change due, and payment method
/// - Strict 3-day validity disclaimer
/// - Monochrome high-contrast typography using Noto Sans Lao for crisp thermal printing
class QuotationReceiptView extends StatelessWidget {
  final List<CartItem> items;
  final int subtotal;
  final int grandTotal;
  final String customerName;
  final String cashierName;
  final String quotationNumber;
  final DateTime createdAt;
  final double receiptWidth; // 576.0 for 80mm, 384.0 for 58mm

  const QuotationReceiptView({
    super.key,
    required this.items,
    required this.subtotal,
    required this.grandTotal,
    this.customerName = 'ລູກຄ້າທົ່ວໄປ',
    this.cashierName = 'ໄມ້ຄຳ (Meii)',
    required this.quotationNumber,
    required this.createdAt,
    this.receiptWidth = 576.0,
  });

  static TextStyle _style({
    required double fontSize,
    FontWeight fontWeight = FontWeight.normal,
    Color color = Colors.black,
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
            'ຮ້ານ Meiishop',
            style: _style(fontSize: 22, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 3),
          Text(
            'ໃບບອກລາຄາ / QUOTATION',
            style: _style(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B)),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),

          // High-visibility Non-Receipt Warning
          Container(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFEF4444), width: 1.2),
            ),
            child: Text(
              '*** ໃບນີ້ບໍ່ແມ່ນໃບບິນຮັບເງິນ / NOT A RECEIPT ***',
              style: _style(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: const Color(0xFFB91C1C),
              ),
              textAlign: TextAlign.center,
            ),
          ),

          const SizedBox(height: 12),
          _buildDashedLine(),
          const SizedBox(height: 8),

          // Meta Info
          _buildMetaRow('ເລກທີໃບສະເໜີ:', quotationNumber, isBold: true),
          _buildMetaRow('ວັນທີ & ເວລາ:', '${dateFormat.format(createdAt)} ${timeFormat.format(createdAt)}'),
          _buildMetaRow('ພະນັກງານ:', cashierName),
          _buildMetaRow('ລູກຄ້າ:', customerName.isNotEmpty ? customerName : 'ລູກຄ້າທົ່ວໄປ'),

          const SizedBox(height: 8),
          _buildDashedLine(),
          const SizedBox(height: 8),

          // Table Header (4 columns)
          Row(
            children: [
              Expanded(
                flex: 4,
                child: Text('ຊື່ລາຍການ', style: _style(fontSize: 11, fontWeight: FontWeight.w800)),
              ),
              Expanded(
                flex: 2,
                child: Text('ຈຳນວນ', style: _style(fontSize: 11, fontWeight: FontWeight.w800), textAlign: TextAlign.center),
              ),
              Expanded(
                flex: 2,
                child: Text('ລາຄາ', style: _style(fontSize: 11, fontWeight: FontWeight.w800), textAlign: TextAlign.right),
              ),
              Expanded(
                flex: 3,
                child: Text('ລວມ (₭)', style: _style(fontSize: 11, fontWeight: FontWeight.w800), textAlign: TextAlign.right),
              ),
            ],
          ),

          const SizedBox(height: 4),
          const Divider(color: Color(0xFF000000), thickness: 1, height: 1),
          const SizedBox(height: 6),

          // Items List
          ...items.map((it) {
            final unitName = it.selectedUnit.unitName;
            final hasCrate = it.noEmptyCrates;
            final feePerCrate = it.product.crateDepositFee > 0 ? it.product.crateDepositFee : 30000;
            final missingCount = it.missingCratesCount ?? it.quantity;
            final crateFeeTotal = hasCrate ? missingCount * feePerCrate : 0;

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3.5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 4,
                        child: Text(
                          '${it.product.name} ($unitName)',
                          style: _style(fontSize: 11.5, fontWeight: FontWeight.w700),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text('${it.quantity}x', style: _style(fontSize: 11), textAlign: TextAlign.center),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          LaoCurrencyFormatter.format(it.effectiveUnitPrice, includeSymbol: false),
                          style: _style(fontSize: 11),
                          textAlign: TextAlign.right,
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          LaoCurrencyFormatter.format(it.effectiveUnitPrice * it.quantity, includeSymbol: false),
                          style: _style(fontSize: 11.5, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),

                  // Crate deposit row if any
                  if (hasCrate) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Expanded(
                          flex: 4,
                          child: Text('↳ ບໍ່ມີລັງປ່ຽນ (ມັດຈຳແກັດ)', style: _style(fontSize: 10, color: const Color(0xFF475569))),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text('${missingCount}x', style: _style(fontSize: 10), textAlign: TextAlign.center),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(LaoCurrencyFormatter.format(feePerCrate, includeSymbol: false), style: _style(fontSize: 10), textAlign: TextAlign.right),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text('+${LaoCurrencyFormatter.format(crateFeeTotal, includeSymbol: false)}',
                              style: _style(fontSize: 10, fontWeight: FontWeight.bold), textAlign: TextAlign.right),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            );
          }),

          const SizedBox(height: 8),
          _buildDashedLine(),
          const SizedBox(height: 8),

          // Subtotal & Grand Total Summary
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('ລວມເງິນສິນຄ້າ (Subtotal):', style: _style(fontSize: 11)),
              Text(LaoCurrencyFormatter.format(subtotal), style: _style(fontSize: 11, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 6),
          const Divider(color: Colors.black, thickness: 1.5, height: 1),
          const SizedBox(height: 6),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ຍອດລວມທັງໝົດ (Total Amount):',
                style: _style(fontSize: 13, fontWeight: FontWeight.w900),
              ),
              Text(
                LaoCurrencyFormatter.format(grandTotal),
                style: _style(fontSize: 16, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Divider(color: Colors.black, thickness: 1.5, height: 1),
          const SizedBox(height: 12),

          // Disclaimers
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('• ໃບສະເໜີລາຄານີ້ມີກຳນົດ 3 ວັນ ນັບຈາກວັນທີອອກໃບ.', style: _style(fontSize: 10, color: const Color(0xFF475569))),
                const SizedBox(height: 2),
                Text('• ລາຄານີ້ອາດມີການປ່ຽນແປງຕາມສະພາບຕະຫຼາດຕົວຈິງ.', style: _style(fontSize: 10, color: const Color(0xFF475569))),
                const SizedBox(height: 2),
                Text('• ຂໍຂອບໃຈລູກຄ້າທີ່ໃຫ້ຄວາມສົນໃຈສິນຄ້າຮ້ານເຮົາ!', style: _style(fontSize: 10, color: const Color(0xFF475569))),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Signatures
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Column(
                children: [
                  Text('ລູກຄ້າ (Customer)', style: _style(fontSize: 10.5, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 26),
                  Text('...............................', style: _style(fontSize: 9, color: Colors.grey)),
                ],
              ),
              Column(
                children: [
                  Text('ພະນັກງານອອກໃບ (Staff)', style: _style(fontSize: 10.5, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 26),
                  Text('...............................', style: _style(fontSize: 9, color: Colors.grey)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }

  Widget _buildMetaRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: _style(fontSize: 11, color: const Color(0xFF475569))),
          Text(
            value,
            style: _style(
              fontSize: 11,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashedLine() {
    return Row(
      children: List.generate(
        35,
        (i) => Expanded(
          child: Container(
            color: i % 2 == 0 ? const Color(0xFF94A3B8) : Colors.transparent,
            height: 1,
          ),
        ),
      ),
    );
  }
}
