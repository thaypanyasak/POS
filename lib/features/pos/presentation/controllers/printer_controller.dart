import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../domain/models/sale_transaction.dart';
import '../../../printer/lao_receipt_printer_service.dart';

class PrinterState {
  final PrinterConfig config;
  final bool isPrinting;
  final String? lastStatusMessage;
  final bool? lastPrintSuccess;

  const PrinterState({
    required this.config,
    this.isPrinting = false,
    this.lastStatusMessage,
    this.lastPrintSuccess,
  });

  PrinterState copyWith({
    PrinterConfig? config,
    bool? isPrinting,
    String? lastStatusMessage,
    bool? lastPrintSuccess,
  }) {
    return PrinterState(
      config: config ?? this.config,
      isPrinting: isPrinting ?? this.isPrinting,
      lastStatusMessage: lastStatusMessage ?? this.lastStatusMessage,
      lastPrintSuccess: lastPrintSuccess ?? this.lastPrintSuccess,
    );
  }
}

class PrinterNotifier extends StateNotifier<PrinterState> {
  final LaoReceiptPrinterService _printerService;

  PrinterNotifier()
      : _printerService = LaoReceiptPrinterService(
          config: const PrinterConfig(
            ipAddress: '192.168.1.200',
            port: 9100,
            paperWidthDots: 576, // 80mm
            openCashDrawerOnPrint: true,
            autoCut: true,
            isSimulationMode: true, // Default to true for dev / preview reliability
          ),
        ),
        super(
          const PrinterState(
            config: PrinterConfig(
              ipAddress: '192.168.1.200',
              port: 9100,
              paperWidthDots: 576,
              openCashDrawerOnPrint: true,
              autoCut: true,
              isSimulationMode: true,
            ),
          ),
        );

  LaoReceiptPrinterService get service => _printerService;

  void updateConfig(PrinterConfig newConfig) {
    _printerService.updateConfig(newConfig);
    state = state.copyWith(config: newConfig);
  }

  void toggleSimulation(bool isSimulation) {
    final newConfig = state.config.copyWith(isSimulationMode: isSimulation);
    updateConfig(newConfig);
  }

  void updatePrinterIp(String ip) {
    final newConfig = state.config.copyWith(ipAddress: ip.trim());
    updateConfig(newConfig);
  }

  /// Silent print transaction
  Future<PrintResult> printTransactionReceipt(SaleTransaction transaction) async {
    state = state.copyWith(isPrinting: true, lastStatusMessage: 'ກຳລັງພິມໃບບິນ...');

    try {
      final result = await _printerService.printReceipt(transaction: transaction);
      state = state.copyWith(
        isPrinting: false,
        lastStatusMessage: result.message,
        lastPrintSuccess: result.success,
      );
      return result;
    } catch (e) {
      final errorMsg = 'ຜິດພາດ: $e';
      state = state.copyWith(
        isPrinting: false,
        lastStatusMessage: errorMsg,
        lastPrintSuccess: false,
      );
      return PrintResult(success: false, message: errorMsg);
    }
  }

  /// Open Cash drawer
  Future<PrintResult> openCashDrawer() async {
    state = state.copyWith(isPrinting: true, lastStatusMessage: 'ກຳລັງເປີດລິ້ນຊັກ...');
    try {
      final result = await _printerService.openCashDrawer();
      state = state.copyWith(
        isPrinting: false,
        lastStatusMessage: result.message,
        lastPrintSuccess: result.success,
      );
      return result;
    } catch (e) {
      final errorMsg = 'ຜິດພາດ: $e';
      state = state.copyWith(
        isPrinting: false,
        lastStatusMessage: errorMsg,
        lastPrintSuccess: false,
      );
      return PrintResult(success: false, message: errorMsg);
    }
  }
}

final printerProvider =
    StateNotifierProvider<PrinterNotifier, PrinterState>((ref) {
  return PrinterNotifier();
});
