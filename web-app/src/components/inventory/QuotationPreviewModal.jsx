import React, { useMemo } from 'react';
import ReceiptModal from '../ReceiptModal';
import { getEffectiveUnitPrice } from '../../utils/formatters';

export default function QuotationPreviewModal({
  isOpen,
  onClose,
  cart = [],
  cartSubtotal = 0,
  customerName = 'ລູກຄ້າທົ່ວໄປ',
  customerPhone = '',
  cashierName = 'Meii',
  products = [],
  onAlert,
}) {
  const now = new Date();
  const quotationNumber = `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`;

  // Convert cart items into the standardized receipt format
  const quotationReceipt = useMemo(() => {
    // If products array not passed directly, try fallback from localStorage
    let productsPool = products;
    if (!productsPool || productsPool.length === 0) {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) productsPool = parsed;
        }
      } catch (_) {}
    }

    const formattedItems = (cart || []).map((it, idx) => {
      const isBundle = Boolean(it.isBundle || it.is_bundle || it.bundleId || (it.bundleComponents && it.bundleComponents.length > 0));
      const rawUnitName = it.unit?.unitName || it.unitName || it.unit_name || 'ອັນ';
      const tierPrice = getEffectiveUnitPrice(it.unit, it.selectedPriceTier || 1);
      const standardPrice = it.isHalfCarton ? Math.round(tierPrice / 2) : tierPrice;
      const effectivePrice = Number(
        it.customPrice !== undefined && it.customPrice !== null
          ? it.customPrice
          : isBundle
          ? (it.unitPrice ?? it.price ?? it.effectivePrice ?? standardPrice)
          : (it.effectivePrice ?? standardPrice)
      ) || 0;

      const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
      const hasMissingCrates = Boolean(!isBundle && it.noEmptyCrates);
      const missingCount = Number(it.missingCratesCount) || (hasMissingCrates ? it.quantity : 0);
      const crateDepositTotal = hasMissingCrates ? missingCount * feePerCrate : 0;
      const baseTotal = isBundle && it.lineTotal ? Number(it.lineTotal) : effectivePrice * (it.quantity || 1);
      const lineTotal = baseTotal + crateDepositTotal;

      const rawComps = it.bundle_components || it.bundleComponents || [];
      const bundleComponents = Array.isArray(rawComps) ? rawComps : [];

      return {
        id: it.product?.id || it.id || `qt_item_${idx}`,
        productId: it.product?.id || it.id,
        name: it.bundleName || it.product?.name || it.name || 'ສິນຄ້າ',
        name_vi: it.bundleNameVi || it.product?.name_vi || it.product?.nameVi || it.name_vi || it.nameVi,
        productNameVi: it.bundleNameVi || it.product?.name_vi || it.product?.nameVi,
        product_name_vi: it.bundleNameVi || it.product?.name_vi || it.product?.nameVi,
        unitName: rawUnitName,
        unit_name: rawUnitName,
        unit: it.unit,
        quantity: it.quantity || 1,
        unitPrice: effectivePrice,
        unit_price: effectivePrice,
        effectivePrice: effectivePrice,
        effectiveUnitPrice: effectivePrice,
        customPrice: it.customPrice,
        isHalfCarton: Boolean(it.isHalfCarton),
        noEmptyCrates: hasMissingCrates,
        missingCratesCount: missingCount,
        crateDepositFee: feePerCrate,
        crateDepositTotal: crateDepositTotal,
        lineTotal: lineTotal,
        line_total: lineTotal,
        product: it.product,
        // Preserve all bundle specifications for bill preview and printing
        isBundle,
        is_bundle: isBundle,
        bundleId: it.bundleId,
        bundleName: it.bundleName || it.name,
        bundleNameVi: it.bundleNameVi || it.name_vi,
        bundleComponents,
        bundle_components: bundleComponents,
        bundleChildImages: it.bundleChildImages || [],
        packageQty: it.packageQty,
        package_qty: it.packageQty,
        baseUnitName: it.baseUnitName,
        cartonQty: it.cartonQty,
        looseQty: it.looseQty,
        cartonPrice: it.cartonPrice,
        loosePriceTotal: it.loosePriceTotal,
      };
    });

    return {
      id: quotationNumber,
      receiptNumber: quotationNumber,
      isQuotation: true,
      createdAt: now.toISOString(),
      cashierName: (!cashierName || cashierName.includes('\u0ec4\u0ea1\u0ec9\u0e84\u0eb3') || cashierName.includes('Meii')) ? 'Meii' : cashierName,
      customerName: customerName || 'ລູກຄ້າທົ່ວໄປ',
      customerPhone: customerPhone || '',
      paymentMethod: 'quotation',
      items: formattedItems,
      subtotal: cartSubtotal,
      grandTotal: cartSubtotal,
      totalCrateDeposit: 0,
      discount: 0,
      amountTendered: 0,
      changeAmount: 0,
      status: 'QUOTATION',
      products: productsPool,
    };
  }, [cart, cartSubtotal, customerName, cashierName, quotationNumber, products]);

  if (!isOpen) return null;

  return (
    <ReceiptModal
      isOpen={isOpen}
      onClose={onClose}
      receipt={quotationReceipt}
      products={products}
      onAlert={onAlert}
    />
  );
}
