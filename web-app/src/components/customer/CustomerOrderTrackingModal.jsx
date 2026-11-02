import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  Package,
  Moped,
  Buildings,
  Phone,
  WhatsappLogo,
  Copy,
  Check,
  X,
  XCircle,
  ArrowsClockwise,
  MapPin,
  CurrencyCircleDollar,
} from '@phosphor-icons/react';
import { supabase } from '../../services/supabase';
import { formatKip } from '../../utils/formatters';
import { playSuccessBeep } from '../../utils/audioFeedback';

export default function CustomerOrderTrackingModal({
  isOpen,
  onClose,
  order,
  onStatusUpdate,
  hotlineNumbers = ['020 56468780', '020 52228432'],
  whatsappInternational = '8562052228432',
}) {
  const [copied, setCopied] = useState(false);

  // Read latest cached status immediately from localStorage to prevent grey/green jitter
  const getInitialStatus = () => {
    if (!order?.id) return 'PENDING';
    try {
      const stored = JSON.parse(localStorage.getItem('meiishop_customer_recent_orders_v1') || '[]');
      const found = stored.find((o) => o.id === order.id);
      if (found?.online_status || found?.onlineStatus) {
        return (found.online_status || found.onlineStatus).toUpperCase();
      }
    } catch (_) {}
    return (order.online_status || order.onlineStatus || 'PENDING').toUpperCase();
  };

  const [currentStatus, setCurrentStatus] = useState(getInitialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  // Keep status in sync immediately when modal opens or order changes (Frame 0 rendering)
  useEffect(() => {
    if (order?.id && isOpen) {
      const st = getInitialStatus();
      setCurrentStatus(st);
    }
  }, [order?.id, isOpen]);

  // Realtime Polling & Supabase listener when modal is open
  useEffect(() => {
    if (!isOpen || !order?.id) return;

    // 1. If order is already completed or cancelled, state is terminal — ZERO Supabase requests!
    const initialSt = getInitialStatus();
    if (initialSt === 'COMPLETED' || initialSt === 'CANCELLED') {
      setCurrentStatus(initialSt);
      return;
    }

    let isMounted = true;

    // Check status function
    const fetchLatestStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('sale_transactions')
          .select('online_status, payment_status')
          .eq('id', order.id)
          .single();

        if (!error && data && isMounted) {
          const newSt = (data.online_status || 'PENDING').toUpperCase();
          setCurrentStatus((prev) => {
            if (prev !== newSt) {
              playSuccessBeep();
              onStatusUpdate?.(order.id, newSt);
              try {
                const stored = JSON.parse(localStorage.getItem('meiishop_customer_recent_orders_v1') || '[]');
                const updated = stored.map((o) => (o.id === order.id ? { ...o, online_status: newSt, onlineStatus: newSt } : o));
                localStorage.setItem('meiishop_customer_recent_orders_v1', JSON.stringify(updated));
              } catch (_) {}
            }
            return newSt;
          });
          setLastUpdated(Date.now());
        }
      } catch (_) {}
    };

    // Initial check
    fetchLatestStatus();

    // Also subscribe to Supabase Realtime for instant update without continuous polling
    const channel = supabase
      .channel(`customer_order_track_${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sale_transactions',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newSt = (payload.new?.online_status || 'PENDING').toUpperCase();
          setCurrentStatus(newSt);
          playSuccessBeep();
          onStatusUpdate?.(order.id, newSt);
          try {
            const stored = JSON.parse(localStorage.getItem('meiishop_customer_recent_orders_v1') || '[]');
            const updated = stored.map((o) => (o.id === order.id ? { ...o, online_status: newSt, onlineStatus: newSt } : o));
            localStorage.setItem('meiishop_customer_recent_orders_v1', JSON.stringify(updated));
          } catch (_) {}
        }
      )
      .subscribe();

    // Relaxed 15s polling fallback only while in-flight (stops immediately when terminal)
    const interval = setInterval(() => {
      fetchLatestStatus();
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const actualOrder = order.order || order;
  const isPickup =
    actualOrder.fulfillment_type === 'pickup' ||
    actualOrder.fulfillmentType === 'pickup';

  const orderCode =
    actualOrder.receiptNumber ||
    actualOrder.receipt_number ||
    (actualOrder.id?.startsWith('onl_')
      ? `ONL-${(actualOrder.id || '').split('_').pop()?.toUpperCase()}`
      : actualOrder.id);

  const handleCopyCode = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await supabase
        .from('sale_transactions')
        .select('online_status, payment_status')
        .eq('id', actualOrder.id)
        .single();
      if (data) {
        const newSt = (data.online_status || 'PENDING').toUpperCase();
        setCurrentStatus(newSt);
        setLastUpdated(Date.now());
      }
    } catch (_) {}
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Compute active step index: 0 = Pending, 1 = Preparing, 2 = Ready, 3 = Completed
  const getStepIndex = (st) => {
    switch (st) {
      case 'PENDING':
        return 0;
      case 'PREPARING':
        return 1;
      case 'READY':
        return 2;
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  };

  const activeStep = getStepIndex(currentStatus);
  const isCancelled = currentStatus === 'CANCELLED';

  const steps = [
    { label: 'ສັ່ງສຳເລັດ', desc: 'ສົ່ງຂໍ້ມູນໃຫ້ຮ້ານ' },
    { label: 'ຮ້ານກຳລັງຈັດ', desc: 'ກຳລັງກຽມເຄື່ອງ' },
    { label: isPickup ? 'ພ້ອມຮັບ' : 'ພ້ອມສົ່ງ', desc: isPickup ? 'ມາຮັບຢູ່ຮ້ານ' : 'ກຳລັງຈັດສົ່ງ' },
    { label: 'ສຳເລັດ', desc: 'ຮັບເຄື່ອງແລ້ວ' },
  ];

  const items = actualOrder.sale_transaction_items || actualOrder.items || [];
  const grandTotal = Number(actualOrder.grand_total || actualOrder.grandTotal || actualOrder.total_lak || 0);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-in fade-in duration-200">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold shrink-0 border border-teal-200 shadow-2xs">
              <Package size={22} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight font-mono truncate">
                  #{orderCode}
                </h3>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="ສຳເນົາລະຫັດອໍເດີ"
                >
                  {copied ? <Check size={13} className="text-teal-600" /> : <Copy size={13} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ອັບເດດສະຖານະສົດ</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  className="text-teal-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <ArrowsClockwise size={11} className={isRefreshing ? 'animate-spin' : ''} />
                  <span>ຣີເຟຣຊ</span>
                </button>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1 no-scrollbar">
          {/* Status Alert Banner */}
          {isCancelled ? (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-2.5">
              <XCircle size={24} weight="fill" className="text-rose-600 shrink-0" />
              <div>
                <div className="font-bold text-sm">ອໍເດີນີ້ຖືກຍົກເລີກແລ້ວ</div>
                <div className="text-[11px] text-rose-700 mt-0.5">
                  ຫາກມີຂໍ້ສົງໄສ ກະລຸນາຕິດຕໍ່ຮ້ານຜ່ານ WhatsApp ຫຼື ເບີໂທຂ້າງລຸ່ມ.
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                currentStatus === 'PENDING'
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                  : currentStatus === 'PREPARING'
                  ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                  : currentStatus === 'READY'
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-teal-50/80 border-teal-300 text-teal-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 mt-0.5">
                  {currentStatus === 'PENDING' && (
                    <Clock size={22} weight="fill" className="text-amber-600 animate-pulse" />
                  )}
                  {currentStatus === 'PREPARING' && (
                    <Package size={22} weight="fill" className="text-blue-600 animate-bounce" />
                  )}
                  {currentStatus === 'READY' && (
                    <CheckCircle size={22} weight="fill" className="text-emerald-600 animate-pulse" />
                  )}
                  {currentStatus === 'COMPLETED' && (
                    <CheckCircle size={22} weight="fill" className="text-teal-700" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm">
                    {currentStatus === 'PENDING' && 'ລໍຖ້າຮ້ານກວດສອບ & ຢືນຢັນ...'}
                    {currentStatus === 'PREPARING' && 'ຮ້ານກຳລັງຈັດກຽມສິນຄ້າ...'}
                    {currentStatus === 'READY' &&
                      (isPickup
                        ? 'ສິນຄ້າພ້ອມຮັບແລ້ວ! ແວ່ມາຮັບໄດ້ເລີຍ'
                        : 'ສິນຄ້າພ້ອມສົ່ງແລ້ວ! ກຳລັງນຳສົ່ງ')}
                    {currentStatus === 'COMPLETED' && 'ອໍເດີສຳເລັດຮຽບຮ້ອຍແລ້ວ!'}
                  </div>
                  <p className="text-[11px] opacity-85 mt-1 leading-relaxed">
                    {currentStatus === 'PENDING' &&
                      'ຮ້ານໄດ້ຮັບອໍເດີຂອງທ່ານແລ້ວ, ພະນັກງານກຳລັງກວດສອບສິນຄ້າໃນສາງ.'}
                    {currentStatus === 'PREPARING' &&
                      'ພະນັກງານກຳລັງຈັດກຽມສິນຄ້າ ແລະ ຫໍ່ເຄື່ອງຢ່າງລະມັດລະວັງ.'}
                    {currentStatus === 'READY' &&
                      (isPickup
                        ? 'ສິນຄ້າຖືກຈັດໃສ່ຖົງພ້ອມແລ້ວ, ທ່ານສາມາດແວ່ມາຮັບຢູ່ຮ້ານໄດ້ທຸກເວລາ.'
                        : 'ຄົນສົ່ງເຄື່ອງກຳລັງມຸ່ງໜ້າໄປຈັດສົ່ງຮອດບ່ອນຕາມທີ່ຢູ່ຂອງທ່ານ.')}
                    {currentStatus === 'COMPLETED' &&
                      'ຂອບໃຈຫຼາຍໆທີ່ເລືອກຊື້ສິນຄ້າກັບ ຮ້ານ ສົມສັກ (MeiiShop).'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4-Step Interactive Progress Bar */}
          {!isCancelled && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                ຂັ້ນຕອນການດຳເນີນການ:
              </div>

              <div className="grid grid-cols-4 gap-1 relative">
                {steps.map((st, idx) => {
                  const isDone = activeStep >= idx;
                  const isCurrent = activeStep === idx;

                  return (
                    <div key={idx} className="flex flex-col items-center text-center">
                      {/* Step Indicator Circle */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 transition-all shadow-2xs ${
                          isDone
                            ? 'bg-teal-600 text-white font-black ring-4 ring-teal-100'
                            : 'bg-slate-200 text-slate-500'
                        } ${isCurrent ? 'scale-110' : ''}`}
                      >
                        {isDone ? <Check size={14} weight="bold" /> : idx + 1}
                      </div>

                      <span
                        className={`text-[11px] font-bold tracking-tight block truncate w-full ${
                          isDone ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {st.label}
                      </span>
                      <span className="text-[9.5px] text-slate-400 hidden sm:block truncate w-full">
                        {st.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delivery & Fulfillment Info */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
              ຮູບແບບການຮັບສິນຄ້າ:
            </div>
            {isPickup ? (
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-1.5 text-teal-800">
                  <Buildings size={15} weight="bold" className="text-teal-600" />
                  <span>ມາຮັບເອງທີ່ຮ້ານ</span>
                </span>
                {(actualOrder.pickup_time || actualOrder.pickupTime) && (
                  <span className="font-mono text-teal-900 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200 text-[11px]">
                    ເວລາ: {actualOrder.pickup_time || actualOrder.pickupTime}
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-sky-900">
                  <Moped size={15} weight="bold" className="text-sky-600" />
                  <span>ສົ່ງຮອດບ່ອນ (Delivery)</span>
                </div>
                {(actualOrder.delivery_address || actualOrder.deliveryAddress) && (
                  <div className="text-[11px] text-slate-700 flex items-start gap-1 pl-4">
                    <MapPin size={12} weight="bold" className="text-sky-600 shrink-0 mt-0.5" />
                    <span>{actualOrder.delivery_address || actualOrder.deliveryAddress}</span>
                  </div>
                )}
              </div>
            )}

            {(actualOrder.delivery_note || actualOrder.deliveryNote) && (
              <div className="text-[11px] text-slate-600 italic bg-white p-2 rounded-xl border border-slate-200 mt-1">
                ໝາຍເຫດ: "{actualOrder.delivery_note || actualOrder.deliveryNote}"
              </div>
            )}
          </div>

          {/* Product Items Breakdown */}
          <div className="space-y-1.5">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>ລາຍການສິນຄ້າ ({items.length})</span>
              <span>ຍອດລວມ</span>
            </div>

            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
              {items.map((it, idx) => {
                const pName = it.product_name || it.productName || it.name || 'ສິນຄ້າ';
                const uName = it.unit_name || it.unitName || 'ອັນ';
                const qty = Number(it.quantity) || 1;
                const price = Number(it.unit_price || it.price || 0);
                const lineTot = Number(it.line_total || it.lineTotal || price * qty);

                return (
                  <div key={idx} className="p-2.5 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-900 truncate">{pName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatKip(price)} × {qty} {uName}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-900 shrink-0">
                      {formatKip(lineTot)}
                    </span>
                  </div>
                );
              })}

              <div className="p-3 bg-slate-50 flex items-center justify-between font-bold">
                <span className="flex items-center gap-1 text-slate-600">
                  <CurrencyCircleDollar size={14} weight="bold" />
                  <span>
                    {actualOrder.payment_method === 'transfer' ? 'ໂອນ BCEL One' : 'ເງິນສົດ (COD)'}
                  </span>
                </span>
                <span className="text-base font-black font-mono text-teal-800">
                  {formatKip(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Support Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${whatsappInternational}?text=${encodeURIComponent(
                `ສະບາຍດີ ຮ້ານ ສົມສັກ! ຂ້ອຍຕ້ອງການສອບຖາມກ່ຽວກັບອໍເດີ #${orderCode}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95 cursor-pointer"
            >
              <WhatsappLogo size={15} weight="fill" />
              <span>WhatsApp ຮ້ານ</span>
            </a>

            {hotlineNumbers[0] && (
              <a
                href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
                className="h-9 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95"
              >
                <Phone size={13} weight="bold" />
                <span>ໂທ {hotlineNumbers[0]}</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-2xs"
          >
            ປິດ
          </button>
        </div>
      </div>
    </div>
  );
}

