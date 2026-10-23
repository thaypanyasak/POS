import { WebPlugin } from '@capacitor/core';
import type { ThermalPrinterPlugin, PrintOptions, TestPrintOptions, PrintResult } from './thermalPrinter';

export class ThermalPrinterWeb extends WebPlugin implements ThermalPrinterPlugin {
  async printReceipt(options: PrintOptions): Promise<PrintResult> {
    console.warn('[ThermalPrinterWeb] printReceipt called on web. IP:', options.ip, 'Port:', options.port);
    // On web browser, trigger native window.print() if user desires
    if (typeof window !== 'undefined') {
      window.print();
    }
    return {
      success: true,
      message: 'Web print window opened (Native CoreGraphics ESC/POS printing is available on iOS app)',
    };
  }

  async testPrint(options: TestPrintOptions): Promise<PrintResult> {
    console.warn('[ThermalPrinterWeb] testPrint called on web. IP:', options.ip, 'Port:', options.port);
    return {
      success: true,
      message: `Web test connection check for ${options.ip}:${options.port} (Full ESC/POS socket test runs on iOS app)`,
    };
  }
}
