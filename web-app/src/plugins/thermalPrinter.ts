import { registerPlugin } from '@capacitor/core';

export interface OrderItem {
  id?: string | number;
  product_id?: string | number;
  name?: string;
  name_vi?: string;
  productName?: string;
  product_name?: string;
  product_name_vi?: string;
  quantity?: number;
  qty?: number;
  unit?: string;
  unit_price?: number;
  price?: number;
  total_price?: number;
  total?: number;
  hasCrateDeposit?: boolean;
  missingCrateCount?: number;
  feePerCrate?: number;
  crateTotal?: number;
}

export interface ReceiptData {
  receiptNumber?: string;
  createdAt?: string;
  date?: string;
  storeName?: string;
  storeSlogan?: string;
  storeAddress?: string;
  storeTel?: string;
  cashierName?: string;
  customerName?: string;
  paymentMethod?: string; // 'cash' | 'qr' | 'debt' | 'transfer'
  items?: OrderItem[];
  sale_transaction_items?: OrderItem[];
  subtotal?: number;
  discount?: number;
  totalCrateDeposit?: number;
  grandTotal?: number;
  amountTendered?: number;
  changeAmount?: number;
  debtAmount?: number;
  qrCodeData?: string;
  isCancelled?: boolean;
  language?: 'lo' | 'vi';
}

export interface PrintOptions {
  ip: string;
  port: number;
  data: ReceiptData;
}

export interface TestPrintOptions {
  ip: string;
  port: number;
}

export interface PrintResult {
  success: boolean;
  message?: string;
}

export interface ThermalPrinterPlugin {
  printReceipt(options: PrintOptions): Promise<PrintResult>;
  testPrint(options: TestPrintOptions): Promise<PrintResult>;
}

const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter', {
  web: () => import('./thermalPrinterWeb').then((m) => new m.ThermalPrinterWeb()),
});

export default ThermalPrinter;
export { ThermalPrinter };
