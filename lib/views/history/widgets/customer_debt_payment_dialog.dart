import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/sale_transaction.dart';
import '../../../../features/pos/presentation/controllers/transaction_controller.dart';

/// Modal dialog for recovering and recording customer debt payments
class CustomerDebtPaymentDialog extends ConsumerStatefulWidget {
  final SaleTransaction transaction;

  const CustomerDebtPaymentDialog({
    super.key,
    required this.transaction,
  });

  static Future<bool?> show(BuildContext context, SaleTransaction tx) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => CustomerDebtPaymentDialog(transaction: tx),
    );
  }

  @override
  ConsumerState<CustomerDebtPaymentDialog> createState() =>
      _CustomerDebtPaymentDialogState();
}

class _CustomerDebtPaymentDialogState
    extends ConsumerState<CustomerDebtPaymentDialog> {
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  String _paymentMethod = 'CASH'; // 'CASH' | 'TRANSFER'
  bool _isSubmitting = false;

  late int _grandTotal;
  late int _currentPaid;
  late int _currentDebt;

  @override
  void initState() {
    super.initState();
    _grandTotal = widget.transaction.grandTotal;
    _currentPaid = widget.transaction.paidAmount > 0
        ? widget.transaction.paidAmount
        : widget.transaction.amountTendered;
    _currentDebt = widget.transaction.debtAmount > 0
        ? widget.transaction.debtAmount
        : (_grandTotal - _currentPaid).clamp(0, _grandTotal);

    // Default to full remaining debt amount
    _amountController.text = _formatNumber(_currentDebt);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  String _formatNumber(int val) {
    return val.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }

  int _parseEnteredAmount() {
    final clean = _amountController.text.replaceAll('.', '').trim();
    return int.tryParse(clean) ?? 0;
  }

  void _onAmountChanged(String val) {
    final digitsOnly = val.replaceAll(RegExp(r'[^\d]'), '');
    if (digitsOnly.isEmpty) {
      _amountController.value = const TextEditingValue(
        text: '',
        selection: TextSelection.collapsed(offset: 0),
      );
      setState(() {});
      return;
    }

    final parsed = int.tryParse(digitsOnly) ?? 0;
    final formatted = _formatNumber(parsed);
    _amountController.value = TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
    setState(() {});
  }

  Future<void> _handleSubmit() async {
    final amount = _parseEnteredAmount();
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ກະລຸນາປ້ອນຈຳນວນເງິນທີ່ຊຳລະ (> 0)'),
          backgroundColor: Color(0xFFE11D48),
        ),
      );
      return;
    }

    if (amount > _currentDebt) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ຈຳນວນເງິນຊຳລະບໍ່ສາມາດເກີນຍອດໜີ້ຄ້າງ!'),
          backgroundColor: Color(0xFFE11D48),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final ok = await SupabaseSyncService.recordCustomerDebtPayment(
        transactionId: widget.transaction.id,
        paymentAmount: amount,
        paymentMethod: _paymentMethod,
        note: _noteController.text.trim().isNotEmpty
            ? _noteController.text.trim()
            : null,
      );

      if (ok) {
        // Refresh transactions list
        await ref.read(transactionHistoryProvider.notifier).loadTransactions();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'ບັນທຶກການຊຳລະໜີ້ ${LaoCurrencyFormatter.format(amount)} ສຳເລັດແລ້ວ!',
              ),
              backgroundColor: const Color(0xFF0F766E),
            ),
          );
          Navigator.of(context).pop(true);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກການຊຳລະໜີ້!'),
              backgroundColor: Color(0xFFE11D48),
            ),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entered = _parseEnteredAmount();
    final projectedDebt = (_currentDebt - entered).clamp(0, _currentDebt);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        width: 440,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Modal Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.handshake_rounded,
                      color: Color(0xFFD97706), size: 22),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'ຊຳລະໜີ້ລູກຄ້າ (Customer Debt Recovery)',
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'ບິນ: #${widget.transaction.receiptNumber} • ${widget.transaction.customer.name}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  icon: const Icon(Icons.close_rounded,
                      color: Color(0xFF94A3B8), size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 3-Box Overview (Total, Paid, Debt)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        const Text(
                          'ຍອດລວມບິນ',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          LaoCurrencyFormatter.format(_grandTotal),
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 28, color: const Color(0xFFCBD5E1)),
                  Expanded(
                    child: Column(
                      children: [
                        const Text(
                          'ຈ່າຍແລ້ວ',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF059669),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          LaoCurrencyFormatter.format(_currentPaid),
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 28, color: const Color(0xFFCBD5E1)),
                  Expanded(
                    child: Column(
                      children: [
                        const Text(
                          'ຍອດໜີ້ຄ້າງ',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFDC2626),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          LaoCurrencyFormatter.format(_currentDebt),
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFFDC2626),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Quick Preset Action Chips
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'ຈຳນວນເງິນທີ່ລູກຄ້າຈ່າຍ (₭) *',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF334155),
                  ),
                ),
                Row(
                  children: [
                    InkWell(
                      onTap: () {
                        final half = (_currentDebt / 2).round();
                        _amountController.text = _formatNumber(half);
                        setState(() {});
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: const Text(
                          '50%',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFB45309),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    InkWell(
                      onTap: () {
                        _amountController.text = _formatNumber(_currentDebt);
                        setState(() {});
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: const Text(
                          'ຈ່າຍຄົບ 100%',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF047857),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 6),

            // Payment Amount Input
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
              ),
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                suffixText: '₭ ',
                suffixStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF94A3B8),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: Color(0xFF0F766E), width: 1.8),
                ),
              ),
              onChanged: _onAmountChanged,
            ),
            const SizedBox(height: 8),

            // Projected Remaining Debt Banner
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFECDD3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'ຍອດໜີ້ເຫຼືອຫຼັງຈາກຊຳລະ:',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  Text(
                    LaoCurrencyFormatter.format(projectedDebt),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFBE123C),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Payment Method Selector
            const Text(
              'ຮູບແບບການຊຳລະ',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _paymentMethod = 'CASH'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _paymentMethod == 'CASH'
                            ? const Color(0xFFF0FDFA)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _paymentMethod == 'CASH'
                              ? const Color(0xFF0F766E)
                              : const Color(0xFFCBD5E1),
                          width: _paymentMethod == 'CASH' ? 1.5 : 1.0,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '💵 ເງິນສົດ (CASH)',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: _paymentMethod == 'CASH'
                              ? const Color(0xFF0F766E)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _paymentMethod = 'TRANSFER'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _paymentMethod == 'TRANSFER'
                            ? const Color(0xFFEFF6FF)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _paymentMethod == 'TRANSFER'
                              ? const Color(0xFF2563EB)
                              : const Color(0xFFCBD5E1),
                          width: _paymentMethod == 'TRANSFER' ? 1.5 : 1.0,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '📱 ໂອນ / QR (TRANSFER)',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: _paymentMethod == 'TRANSFER'
                              ? const Color(0xFF2563EB)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Note field
            const Text(
              'ໝາຍເຫດ (Note)',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _noteController,
              style: const TextStyle(fontSize: 12, color: Color(0xFF0F172A)),
              decoration: InputDecoration(
                hintText: 'ເຊັ່ນ: BCEL One, ລູກຄ້າມາຈ່າຍທີ່ຮ້ານ...',
                hintStyle:
                    const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text(
                      'ຍົກເລີກ',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle_rounded, size: 16),
                              SizedBox(width: 6),
                              Text(
                                'ບັນທຶກການຊຳລະ',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
