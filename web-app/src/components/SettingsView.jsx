import React, { useState, useEffect } from 'react';
import {
  Gear,
  CurrencyCircleDollar,
  Receipt,
  CloudCheck,
  CloudSlash,
  Folders,
  UsersThree,
  Plus,
  ArrowClockwise,
  ShieldCheck,
  DeviceTablet,
  CheckCircle,
  Tag,
  ClockCounterClockwise,
  PencilSimple,
  FloppyDisk,
  X,
  Printer,
  HandCoins,
} from '@phosphor-icons/react';
import { Capacitor } from '@capacitor/core';
import { updateExchangeRateInSupabase } from '../services/supabase';
import queryClient from '../services/queryClient';
import { formatDots, parseDots } from '../utils/formatters';
import { getPrinterConfig, savePrinterConfig, openCashDrawerDirect } from '../services/printerService';

export default function SettingsView({
  exchangeRate = 0,
  setExchangeRate,
  onAlert,
  isCloudSynced = false,
  productsCount = 0,
  transactionsCount = 0,
  outOfStockCount = 0,
  debtCount = 0,
  receiptPaperWidth = 80,
  setReceiptPaperWidth,
  onOpenCategoryManager,
  onOpenSupplierManager,
  onAddNewProduct,
  onRefreshAll,
  isLoading = false,
}) {
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(exchangeRate || ''));
  const [isSavingRate, setIsSavingRate] = useState(false);

  useEffect(() => {
    if (exchangeRate) setRateInput(String(exchangeRate));
  }, [exchangeRate]);

  const handleSaveRate = async () => {
    const val = parseInt(rateInput, 10);
    if (!val || val <= 0) {
      onAlert?.('ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0)!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }
    setIsSavingRate(true);
    try {
      await updateExchangeRateInSupabase(val);
      setExchangeRate?.(val);
      await queryClient.invalidateQueries({ queryKey: ['exchange_rate'] });
      await queryClient.invalidateQueries({ queryKey: ['store_settings'] });
      setIsEditingRate(false);
      onAlert?.(`ອັບເດດອັດຕາແລກປ່ຽນ: 1 ฿ = ${formatDots(val)} ₭ ສຳເລັດ!`, 'ສຳເລັດ', 'success');
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກອັດຕາແລກປ່ຽນ', 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsSavingRate(false);
    }
  };

  // Printer Settings State (LAN / Wi-Fi IP, Port, Paper Width)
  const [printerIp, setPrinterIp] = useState(() => getPrinterConfig().ip);
  const [printerPort, setPrinterPort] = useState(() => getPrinterConfig().port);
  const [printerAutoCut, setPrinterAutoCut] = useState(() => getPrinterConfig().autoCut);
  const [printerDrawerKick, setPrinterDrawerKick] = useState(() => getPrinterConfig().drawerKick);

  const [localPaperWidth, setLocalPaperWidth] = useState(() => getPrinterConfig().paperWidth || receiptPaperWidth);
  const paperWidth = setReceiptPaperWidth ? receiptPaperWidth : localPaperWidth;

  const handlePaperWidthChange = (val) => {
    if (setReceiptPaperWidth) {
      setReceiptPaperWidth(val);
    }
    setLocalPaperWidth(val);
    savePrinterConfig({ paperWidth: val });
  };

  const handleSavePrinterSettings = () => {
    savePrinterConfig({
      ip: printerIp.trim(),
      port: parseInt(printerPort, 10) || 9100,
      paperWidth,
      autoCut: printerAutoCut,
      drawerKick: printerDrawerKick,
    });
    onAlert?.(
      `ບັນທຶກການຕັ້ງຄ່າເຄື່ອງພິມ ${printerIp.trim()}:${printerPort} (${paperWidth}mm) ສຳເລັດ!`,
      'ສຳເລັດ',
      'success'
    );
  };

  const handleTestKickDrawer = async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        onAlert?.(
          'ຄຳສັ່ງເປີດລິ້ນຊັກເງິນ ESC/POS ຮອງຮັບສະເພາະເມື່ອເປີດຜ່ານ App Capacitor ທີ່ເຊື່ອມຕໍ່ IP ເຄື່ອງພິມ LAN/Wi-Fi.',
          'ແຈ້ງເຕືອນ',
          'info'
        );
        return;
      }
      const res = await openCashDrawerDirect();
      if (res.success) {
        onAlert?.('ສົ່ງຄຳສັ່ງເປີດລິ້ນຊັກເງິນສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
      } else {
        onAlert?.(res.message, 'ແຈ້ງເຕືອນ', 'warning');
      }
    } catch (err) {
      onAlert?.(`ບໍ່ສາມາດເປີດລິ້ນຊັກ: ${err.message}`, 'ຂໍ້ຜິດພາດ', 'error');
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto bg-slate-100 p-4 md:p-6 lg:p-8 overscroll-contain">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-slate-200/80 mb-3 sm:mb-4 gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
              <Gear size={20} className="sm:w-5 sm:h-5" weight="duotone" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="truncate">ຕັ້ງຄ່າລະບົບ (Settings)</span>
              </h1>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ຈັດການຂໍ້ມູນຮ້ານຄ້າ, ອັດຕາແລກປ່ຽນ ແລະ ລະບົບພິມບິນ MeiiShop POS
              </p>
            </div>
          </div>

          {onRefreshAll && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onRefreshAll}
                disabled={isLoading}
                className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                title="ໂຫຼດຂໍ້ມູນຄືນ"
              >
                <ArrowClockwise size={15} weight="bold" className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">ຣີເຟຣຊຂໍ້ມູນ</span>
              </button>
            </div>
          )}
        </div>

        {/* 2x2 Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Currency & Exchange Rate */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <CurrencyCircleDollar size={22} weight="fill" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    ອັດຕາຕົ້ນທຶນເງິນບາດ (THB / LAK)
                  </h2>
                  <p className="text-xs text-slate-500">
                    ໃຊ້ສຳລັບແປງຕົ້ນທຶນສິນຄ້ານຳເຂົ້າຈາກໄທ ເປັນກີບລາວ
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs text-slate-500 font-semibold block">
                    ອັດຕາແລກປ່ຽນປະຈຸບັນ
                  </span>
                  {!isEditingRate ? (
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-black text-slate-900 tabular-nums">
                        1 ฿ = {formatDots(exchangeRate)} ₭
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500">1 ฿ =</span>
                      <input
                        type="number"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        className="w-28 px-2.5 py-1.5 bg-white border border-teal-400 rounded-lg text-sm font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="0"
                      />
                      <span className="text-xs font-mono font-bold text-slate-500">₭</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isEditingRate ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingRate(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-teal-700 border border-teal-200 shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <PencilSimple size={14} weight="bold" />
                      <span>ແກ້ໄຂ</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRateInput(String(exchangeRate));
                          setIsEditingRate(false);
                        }}
                        disabled={isSavingRate}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                      >
                        <X size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRate}
                        disabled={isSavingRate}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                      >
                        <FloppyDisk size={14} weight="bold" />
                        <span>{isSavingRate ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                ໝາຍເຫດ: ລາຄາຕົ້ນທຶນບາດຂອງສິນຄ້າຈະຖືກຄິດໄລ່ອັດຕະໂນມັດຕາມອັດຕານີ້ (1 ບາດ = {formatDots(exchangeRate)} ກີບ) ເພື່ອຮັບປະກັນກຳໄລຂັ້ນຕົ້ນທີ່ຖືກຕ້ອງ.
              </p>
            </div>
          </div>

          {/* Card 2: Receipt Printing & LAN/Wi-Fi Hardware Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <Printer size={22} weight="bold" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>ເຄື່ອງພິມບິນຄວາມຮ້ອນ (Thermal Printer)</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        ESC/POS
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      ກຳນົດ IP, Port (LAN/Wi-Fi) ສຳລັບ EasyPrint ES-8803WA ແລະ ຂະໜາດເຈ້ຍ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      Capacitor.isNativePlatform()
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        Capacitor.isNativePlatform() ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'
                      }`}
                    ></span>
                    <span>{Capacitor.isNativePlatform() ? 'Capacitor Native (Direct Socket)' : 'Web Browser (System Print)'}</span>
                  </span>
                </div>
              </div>

              {/* IP Address & Port Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    IP ເຄື່ອງພິມ LAN / Wi-Fi (EasyPrint ES-8803WA)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={printerIp}
                      onChange={(e) => setPrinterIp(e.target.value)}
                      placeholder="192.168.1.200"
                      className="w-full h-10 px-3 font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-2xs"
                    />
                  </div>
                  <span className="text-[10.5px] text-slate-400 mt-1 block">
                    ຄ່າເລີ່ມຕົ້ນມາດຕະຖານ: 192.168.1.200 (ກວດສອບ IP ເທິງໃບ Self-test ຂອງເຄື່ອງພິມ)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Port ເຄື່ອງພິມ (RAW)
                  </label>
                  <input
                    type="number"
                    value={printerPort}
                    onChange={(e) => setPrinterPort(e.target.value)}
                    placeholder="9100"
                    className="w-full h-10 px-3 font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-2xs"
                  />
                  <span className="text-[10.5px] text-slate-400 mt-1 block">
                    ມາດຕະຖານ: 9100
                  </span>
                </div>
              </div>

              {/* Paper Width Options */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ຂະໜາດເຈ້ຍພິມ (Paper Width)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange(80)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paperWidth === 80
                        ? 'bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm">80 mm (3 ນິ້ວ - ES-8803WA)</span>
                      {paperWidth === 80 && (
                        <CheckCircle size={18} weight="fill" className="text-teal-600 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                      ມາດຕະຖານຕັ້ງໂຕະ (576 dots)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange(58)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paperWidth === 58
                        ? 'bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm">58 mm (2 ນິ້ວ - ແບບພົກພາ)</span>
                      {paperWidth === 58 && (
                        <CheckCircle size={18} weight="fill" className="text-teal-600 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                      ເຄື່ອງພິມຂະໜາດນ້ອຍ (384 dots)
                    </span>
                  </button>
                </div>
              </div>

              {/* Hardware Toggles: Drawer Kick & Auto-Cut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={printerDrawerKick}
                    onChange={(e) => setPrinterDrawerKick(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 accent-teal-600"
                  />
                  <span>ເປີດລິ້ນຊັກເງິນອັດຕະໂນມັດ (Cash Drawer Kick)</span>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={printerAutoCut}
                    onChange={(e) => setPrinterAutoCut(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 accent-teal-600"
                  />
                  <span>ຕັດເຈ້ຍອັດຕະໂນມັດ (Auto Cutter)</span>
                </label>
              </div>
            </div>

            {/* Action Bar: Save & Kick Drawer Test */}
            <div className="mt-4 pt-3.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestKickDrawer}
                  className="h-9 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="ທົດສອບຄຳສັ່ງເປີດລິ້ນຊັກເງິນ ESC/POS"
                >
                  <HandCoins size={15} weight="bold" />
                  <span>ທົດສອບເປີດລິ້ນຊັກ</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSavePrinterSettings}
                className="h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <FloppyDisk size={15} weight="bold" />
                <span>ບັນທຶກການຕັ້ງຄ່າເຄື່ອງພິມ</span>
              </button>
            </div>
          </div>

          {/* Card 3: Quick Master Data Management */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Folders size={22} weight="bold" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ຈັດການຂໍ້ມູນຫຼັກ (Master Data)
                </h2>
                <p className="text-xs text-slate-500">
                  ໝວດໝູ່ສິນຄ້າ, ຜູ້ສະໜອງ ແລະ ການເພີ່ມສິນຄ້າໃໝ່
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-teal-50/50 hover:border-teal-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <Tag size={18} weight="bold" />
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-teal-800">
                        ຈັດການໝວດໝູ່ສິນຄ້າ (Categories)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        ເພີ່ມ, ແກ້ໄຂ ແລະ ຈັດລະບຽບກຸ່ມສິນຄ້າ
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-700 group-hover:underline">
                    ເປີດ &rarr;
                  </span>
                </button>
              )}

              {onOpenSupplierManager && (
                <button
                  type="button"
                  onClick={onOpenSupplierManager}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-teal-50/50 hover:border-teal-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <UsersThree size={18} weight="bold" />
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-teal-800">
                        ຈັດການຜູ້ສະໜອງ (Suppliers)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        ລາຍຊື່ຜູ້ສະໜອງ, ເບີໂທ ແລະ ຍອດໜີ້ຄ້າງຈ່າຍ
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-700 group-hover:underline">
                    ເປີດ &rarr;
                  </span>
                </button>
              )}

              {onAddNewProduct && (
                <button
                  type="button"
                  onClick={onAddNewProduct}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-teal-50/50 hover:border-teal-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <Plus size={18} weight="bold" />
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-teal-800">
                        ເພີ່ມສິນຄ້າໃໝ່ (Add Product)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        ລົງທະບຽນບາໂຄດ, ລາຄາ ແລະ 3 ລະດັບຫົວໜ່ວຍ
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-700 group-hover:underline">
                    ເປີດ &rarr;
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Card 4: Cloud Database & System Health */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={22} weight="bold" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ຖານຂໍ້ມູນ Supabase & ສະຖານະ
                </h2>
                <p className="text-xs text-slate-500">
                  ການຊິ້ງຄ໌ຂໍ້ມູນຄລາວ ແລະ ແຄຊໃນເຄື່ອງ
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-600">ສະຖານະຄລາວ</span>
                <div className="flex items-center gap-1.5">
                  {isCloudSynced ? (
                    <>
                      <CloudCheck size={16} className="text-teal-600" weight="fill" />
                      <span className="text-xs font-bold text-teal-700">Online (Synced)</span>
                    </>
                  ) : (
                    <>
                      <CloudSlash size={16} className="text-amber-600" weight="fill" />
                      <span className="text-xs font-bold text-amber-700">Offline / Local Cache</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 block">ສິນຄ້າໃນລະບົບ</span>
                  <span className="font-mono text-base font-bold text-slate-800">
                    {productsCount} ລາຍການ
                  </span>
                  {outOfStockCount > 0 && (
                    <span className="text-[11px] font-mono text-rose-500 font-bold block mt-0.5">
                      (ໝົດສະຕັອກ: {outOfStockCount})
                    </span>
                  )}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 block">ບິນຂາຍທັງໝົດ</span>
                  <span className="font-mono text-base font-bold text-slate-800">
                    {transactionsCount} ບິນ
                  </span>
                  {debtCount > 0 && (
                    <span className="text-[11px] font-mono text-rose-500 font-bold block mt-0.5">
                      (ຕິດໜີ້: {debtCount})
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>MeiiShop POS • Vientiane Laos</span>
                <span className="font-mono font-medium">DESIGN.md Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
