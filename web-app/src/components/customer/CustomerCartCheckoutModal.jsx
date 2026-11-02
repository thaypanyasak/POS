import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Minus,
  Trash,
  Buildings,
  Moped,
  Phone,
  User,
  MapPin,
  Clock,
  Note,
  CreditCard,
  Money,
  CheckCircle,
  WarningCircle,
  Package,
  QrCode,
  ArrowRight,
  CaretLeft,
  ShoppingCart,
  Storefront,
} from '@phosphor-icons/react';
import { formatKip, sanitizeImageUrl } from '../../utils/formatters';
import {
  playQuantityStepBeep,
  playRemoveFromCartBeep,
  playActionClickBeep,
} from '../../utils/audioFeedback';

export default function CustomerCartCheckoutModal({
  isOpen,
  onClose,
  cart = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSubmitOrder,
  isSubmitting = false,
  hotlineNumbers = ['020 56468780', '020 52228432'],
}) {
  // Step state: 'cart' (Xem giỏ hàng) | 'checkout' (Điền thông tin & thanh toán)
  const [step, setStep] = useState('cart');

  // Fulfillment: 'pickup' (ມາຮັບເອງ) | 'delivery' (ສົ່ງຮອດບ່ອນ)
  const [fulfillmentType, setFulfillmentType] = useState('pickup');

  // Customer Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupTime, setPickupTime] = useState('15 ນາທີ');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  // Payment Method: 'cash' | 'transfer'
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Error Alert Message
  const [formError, setFormError] = useState('');

  // Reset to cart step whenever modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('cart');
      setFormError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalItemsCount = cart.reduce(
    (sum, it) => sum + (Number(it.quantity) || 1),
    0
  );
  const grandTotal = cart.reduce(
    (sum, it) =>
      sum + (Number(it.price || it.unitPrice) || 0) * (Number(it.quantity) || 1),
    0
  );

  const handleStepQty = (index, delta) => {
    playQuantityStepBeep();
    const item = cart[index];
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      playRemoveFromCartBeep();
      onRemoveItem(index);
    } else {
      onUpdateQuantity(index, newQty);
    }
  };

  const handleGoToCheckout = () => {
    if (cart.length === 0) return;
    playActionClickBeep();
    setFormError('');
    setStep('checkout');
  };

  const handleBackToCart = () => {
    playActionClickBeep();
    setFormError('');
    setStep('cart');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (cart.length === 0) {
      setFormError('ກະຕ່າສິນຄ້າວ່າງເປົ່າ');
      setStep('cart');
      return;
    }

    if (!customerName.trim()) {
      setFormError('ກະລຸນາປ້ອນ ຊື່ລູກຄ້າ / ຜູ້ຮັບ ');
      return;
    }

    if (!customerPhone.trim()) {
      setFormError('ກະລຸນາປ້ອນ ເບີໂທລະສັບຕິດຕໍ່ ');
      return;
    }

    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      setFormError('ກະລຸນາປ້ອນ ທີ່ຢູ່ຈັດສົ່ງລະອຽດ ');
      return;
    }

    playActionClickBeep();

    if (onSubmitOrder) {
      onSubmitOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        fulfillmentType,
        pickupTime: fulfillmentType === 'pickup' ? pickupTime : null,
        deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : null,
        deliveryNote: deliveryNote.trim() || null,
        paymentMethod,
        subtotal: grandTotal,
        grandTotal,
        items: cart,
      });
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-slate-100 max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        {/* 1. HEADER BAR: Step-aware */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'checkout' ? (
              <button
                type="button"
                onClick={handleBackToCart}
                className="w-8 h-8 -ml-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                title="ກັບຄືນເບິ່ງກະຕ່າ"
              >
                <CaretLeft size={18} weight="bold" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <ShoppingCart size={17} weight="fill" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase truncate">
                  {step === 'cart' ? 'ກະຕ່າສິນຄ້າ ' : 'ຂໍ້ມູນສັ່ງຊື້ & ຈັດສົ່ງ'}
                </h3>
                <span className="text-[10.5px] font-bold text-teal-700 bg-teal-50 px-2 py-0.2 rounded-full border border-teal-200 font-mono shrink-0">
                  {step === 'cart' ? `${totalItemsCount} ອັນ` : 'ຂັ້ນຕອນ 2/2'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors active:scale-95 disabled:opacity-50 shrink-0"
            title="ປິດ"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        {/* 2. BODY CONTENT: Step 1 (Cart Only) vs Step 2 (Information & Payment Only) */}
        {step === 'cart' ? (
          /* ========================================================================= */
          /* STEP 1: CART ONLY (Gọn gàng 100%, chỉ xem món & số lượng, không bị rối)    */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="overflow-y-auto p-3 sm:p-4 space-y-2.5 no-scrollbar flex-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                    <Package size={30} weight="duotone" />
                  </div>
                  <p className="text-xs font-bold text-slate-600">ຍັງບໍ່ມີສິນຄ້າໃນກະຕ່າ</p>
                  <p className="text-[11px] text-slate-400">ກະລຸນາເລືອກສິນຄ້າທີ່ທ່ານຕ້ອງການຊື້</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
                  >
                    ເລືອກຊື້ສິນຄ້າ
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Storefront size={16} weight="fill" className="text-teal-600" />
                      <span>ຮ້ານ ສົມສັກ</span>
                      <span className="text-[10px] text-slate-400 font-mono">({cart.length} ລາຍການ)</span>
                    </div>

                    <button
                      type="button"
                      onClick={onClearCart}
                      className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-medium active:scale-95"
                      title="ລຶບສິນຄ້າທັງໝົດ"
                    >
                      <Trash size={12} />
                      <span>ລຶບທັງໝົດ</span>
                    </button>
                  </div>

                  {/* List of Cart Items */}
                  <div className="divide-y divide-slate-100 max-h-[58vh] overflow-y-auto pr-1 no-scrollbar space-y-1">
                    {cart.map((it, idx) => {
                      const cleanImg = sanitizeImageUrl(it.imageUrl || it.image_url);
                      const displayName =
                        it.productName || it.name || it.product_name || 'ສິນຄ້າ';
                      const unitPrice = Number(it.price || it.unitPrice) || 0;
                      const itemLineTotal = unitPrice * (Number(it.quantity) || 1);

                      return (
                        <div
                          key={`${it.productId || it.id}_${it.unitName}_${idx}`}
                          className="pt-2.5 pb-2 flex items-center justify-between gap-2.5"
                        >
                          {/* Product Thumbnail */}
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 p-1">
                            {cleanImg ? (
                              <img
                                src={cleanImg}
                                alt={displayName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Package size={24} className="text-slate-300" />
                            )}
                          </div>

                          {/* Product Name & Unit Tier Pill */}
                          <div className="min-w-0 flex-1">
                            <h4
                              className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug"
                              title={displayName}
                            >
                              {displayName}
                            </h4>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded-md bg-teal-50 border border-teal-200/90 text-teal-800 font-bold text-[10px]">
                                {it.unitName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono font-medium">
                                {formatKip(unitPrice)}
                              </span>
                            </div>
                          </div>

                          {/* Stepper + Line Total + Remove button */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/80">
                              <button
                                type="button"
                                onClick={() => handleStepQty(idx, -1)}
                                className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 cursor-pointer active:scale-95 shadow-2xs"
                              >
                                <Minus size={11} weight="bold" />
                              </button>
                              <span className="w-7 text-center font-mono font-black text-xs text-slate-800">
                                {it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStepQty(idx, 1)}
                                className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 cursor-pointer active:scale-95 shadow-2xs"
                              >
                                <Plus size={11} weight="bold" />
                              </button>
                            </div>

                            <span className="text-xs font-black font-mono text-slate-900 min-w-[72px] text-right">
                              {formatKip(itemLineTotal)}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                playRemoveFromCartBeep();
                                onRemoveItem(idx);
                              }}
                              className="p-1 rounded-lg text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                              title="ລຶບລາຍການນີ້"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* STEP 1 BOTTOM BAR: Total + Button To Step 2 */}
            {cart.length > 0 && (
              <div className="p-3 sm:px-5 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] shrink-0 z-10">
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500 font-medium">
                    ຍອດລວມ ({totalItemsCount} ອັນ):
                  </div>
                  <div className="text-base sm:text-xl font-black font-mono text-teal-700 tracking-tight leading-none mt-0.5">
                    {formatKip(grandTotal)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoToCheckout}
                  className="h-11 px-5 sm:px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <span>ຕໍ່ໄປ (ສັ່ງຊື້)</span>
                  <ArrowRight size={16} weight="bold" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* STEP 2: CHECKOUT & DELIVERY ONLY (Đã tách riêng thành bước kế tiếp cực gọn) */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="overflow-y-auto p-3 sm:p-4 space-y-3 no-scrollbar flex-1">
              {/* Validation Error Message */}
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <WarningCircle size={16} weight="fill" className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Quick Order Items Summary Pill */}
              <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  <span className="text-slate-600 font-medium truncate">
                    ສັ່ງຊື້ <strong className="text-slate-900 font-bold">{cart.length}</strong> ລາຍການ ({totalItemsCount} ອັນ)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBackToCart}
                  className="text-teal-600 hover:underline font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  ເບິ່ງຄືນ
                </button>
              </div>

              {/* CARD 1: THÔNG TIN NHẬN HÀNG (Tự lấy vs Giao hàng) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600" />

                {/* Header: Title + Compact Segmented Pills */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin size={17} weight="fill" className="text-teal-600 shrink-0" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                      ຂໍ້ມູນການຮັບເຄື່ອງ
                    </span>
                  </div>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        playActionClickBeep();
                        setFulfillmentType('pickup');
                      }}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        fulfillmentType === 'pickup'
                          ? 'bg-teal-600 text-white shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Buildings size={13} weight="bold" />
                      <span>ມາຮັບເອງ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playActionClickBeep();
                        setFulfillmentType('delivery');
                      }}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        fulfillmentType === 'delivery'
                          ? 'bg-teal-600 text-white shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Moped size={13} weight="bold" />
                      <span>ສົ່ງຮອດບ່ອນ</span>
                    </button>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  {/* Row 1: Name and Phone (2 columns) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                        <User size={12} weight="bold" className="text-slate-400" />
                        <span>ຊື່ຜູ້ຮັບ *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="ປ້ອນຊື່ຂອງທ່ານ..."
                        className="w-full h-8 px-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                        <Phone size={12} weight="bold" className="text-slate-400" />
                        <span>ເບີໂທຕິດຕໍ່ *</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="020 / 030..."
                        className="w-full h-8 px-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Row 2: Specific to Fulfillment Type */}
                  {fulfillmentType === 'pickup' ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                        <Clock size={12} weight="bold" className="text-slate-400" />
                        <span>ເວລາຄາດວ່າຈະມາຮັບຮ້ານ:</span>
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['15 ນາທີ', '30 ນາທີ', '1 ຊົ່ວໂມງ', 'ຕອນແລງ'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setPickupTime(t)}
                            className={`h-6 px-2 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors ${
                              pickupTime === t
                                ? 'bg-teal-600 text-white shadow-2xs font-black'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                        <input
                          type="text"
                          value={pickupTime}
                          onChange={(e) => setPickupTime(e.target.value)}
                          placeholder="ຫຼື ພິມເວລາ..."
                          className="h-6 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] text-slate-700 w-24 focus:outline-none focus:border-teal-600"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                        <MapPin size={12} weight="bold" className="text-rose-500" />
                        <span>ທີ່ຢູ່ຈັດສົ່ງລະອຽດ *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="ບ້ານ, ເມືອງ, ຈຸດສັງເກດໃກ້ບ້ານ (Tên bản, mốc đường)..."
                        className="w-full h-8 px-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition-colors"
                      />
                      <div className="text-[9.5px] text-slate-400 mt-0.5">
                        • ຄ່າຈັດສົ່ງຄິດໄລ່ຕາມໄລຍະທາງຕົວຈິງ (ຈ່າຍໃຫ້ຄົນຂັບຕອນຮັບເຄື່ອງ)
                      </div>
                    </div>
                  )}

                  {/* Row 3: Optional Notes */}
                  <div>
                    <input
                      type="text"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="ໝາຍເຫດເພີ່ມເຕີມ: ຫໍ່ໃຫ້ດີ, ໂທຫາຕອນໃກ້ຮອດ..."
                      className="w-full h-7 px-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 2: PHƯƠNG THỨC THANH TOÁN (Payment Method) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
                    <CreditCard size={15} weight="bold" className="text-teal-600" />
                    <span>ວິທີການຊຳລະເງິນ</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`h-9 px-3 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-teal-50 border-teal-600 text-teal-900 font-black shadow-2xs ring-1 ring-teal-500/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 text-xs font-bold'
                    }`}
                  >
                    <Money size={16} weight="bold" className="text-teal-700" />
                    <span className="text-xs">ເງິນສົດ (COD)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`h-9 px-3 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      paymentMethod === 'transfer'
                        ? 'bg-sky-50 border-sky-600 text-sky-900 font-black shadow-2xs ring-1 ring-sky-500/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 text-xs font-bold'
                    }`}
                  >
                    <QrCode size={16} weight="bold" className="text-sky-600" />
                    <span className="text-xs">ໂອນ BCEL One</span>
                  </button>
                </div>

                {paymentMethod === 'transfer' && (
                  <div className="p-2.5 bg-sky-50/80 border border-sky-200 rounded-xl text-[10.5px] text-sky-900 leading-relaxed">
                    💡 ກົດສັ່ງຊື້ແລ້ວໂອນເງິນເຂົ້າບັນຊີ BCEL One ຂອງຮ້ານ ແລະ ສົ່ງສະລິບຜ່ານ WhatsApp ຫາຮ້ານ
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2 BOTTOM BAR: Total + Submit Button */}
            <div className="p-3 sm:px-5 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] shrink-0 z-10">
              <div className="min-w-0">
                <div className="text-[10.5px] text-slate-500 font-medium">
                  ຍອດລວມທັງໝົດ:
                </div>
                <div className="text-base sm:text-xl font-black font-mono text-teal-700 tracking-tight leading-none mt-0.5">
                  {formatKip(grandTotal)}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || cart.length === 0}
                className="h-11 px-5 sm:px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>ກຳລັງສັ່ງຊື້...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={17} weight="bold" />
                    <span>ຢືນຢັນການສັ່ງຊື້</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
