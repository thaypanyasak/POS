import React, { useState, useEffect } from 'react';
import {
  Gear,
  CurrencyCircleDollar,
  Folders,
  UsersThree,
  Plus,
  ArrowClockwise,
  PencilSimple,
  FloppyDisk,
  X,
  Printer,
  HandCoins,
  CheckCircle,
  Tag,
  CaretRight,
  ShieldCheck,
  CloudCheck,
  CloudSlash,
  DownloadSimple,
  Sparkle,
} from '@phosphor-icons/react';
import { Capacitor } from '@capacitor/core';
import { updateExchangeRateInSupabase } from '../services/supabase';
import queryClient from '../services/queryClient';
import { formatDots } from '../utils/formatters';
import { getPrinterConfig, savePrinterConfig, openCashDrawerDirect } from '../services/printerService';
import { liveUpdater } from '../services/liveUpdateService';

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

  const [liveUpdateInfo, setLiveUpdateInfo] = useState({ version: 'ກຳລັງໂຫຼດ...', isNative: false });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    let isMounted = true;
    liveUpdater.getCurrentVersion().then((info) => {
      if (isMounted) setLiveUpdateInfo(info);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualCheckUpdate = async () => {
    if (!Capacitor.isNativePlatform()) {
      onAlert?.('ລະບົບ Live Update OTA ຮອງຮັບສະເພາະເມື່ອເປີດຜ່ານ App Capacitor ໃນ iPad / iPhone.', 'ແຈ້ງເຕືອນ', 'info');
      return;
    }
    setIsCheckingUpdate(true);
    try {
      const res = await liveUpdater.checkForUpdates();
      if (res) {
        onAlert?.('ກວດພົບເວີຊັນໃໝ່ ແລະ ດາວໂຫຼດສຳເລັດ! ກະລຸນາກົດນຳໃຊ້ເພື່ອໂຫຼດລະບົບໃໝ່.', 'ອັບເດດສຳເລັດ', 'success');
      } else {
        onAlert?.('ແອັບຂອງທ່ານເປັນເວີຊັນລ້າສຸດແລ້ວ!', 'ຂໍ້ມູນ', 'info');
      }
    } catch (e) {
      onAlert?.(`ກວດສອບອັບເດດບໍ່ສຳເລັດ: ${e.message}`, 'ແຈ້ງເຕືອນ', 'warning');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto bg-slate-50 p-4 sm:p-6 overscroll-contain">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0 border border-teal-100">
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
                className="p-2 sm:px-3 sm:py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200/80 shadow-2xs"
                title="ໂຫຼດຂໍ້ມູນຄືນ"
              >
                <ArrowClockwise size={15} weight="bold" className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">ຣີເຟຣຊຂໍ້ມູນ</span>
              </button>
            </div>
          )}
        </div>

        {/* 2-Column Minimal ERP Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          {/* ================================================================ */}
          {/* LEFT COLUMN: VẬN HÀNH & DỮ LIỆU GỐC                              */}
          {/* ================================================================ */}
          <div className="space-y-4 sm:space-y-5">
            {/* Card 1: Currency & Exchange Rate */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <CurrencyCircleDollar size={20} weight="fill" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    ອັດຕາຕົ້ນທຶນເງິນບາດ (THB / LAK)
                  </h2>
                  <p className="text-[11.5px] text-slate-500 truncate">
                    ໃຊ້ສຳລັບແປງຕົ້ນທຶນສິນຄ້ານຳເຂົ້າຈາກໄທ ເປັນກີບລາວ
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10.5px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">
                    ອັດຕາແລກປ່ຽນປະຈຸບັນ
                  </span>
                  {!isEditingRate ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-amber-50 border border-amber-200/90 text-amber-900 font-mono text-base sm:text-lg font-black tracking-tight tabular-nums shadow-2xs">
                      1 ฿ = {formatDots(exchangeRate)} ₭
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-500">1 ฿ =</span>
                      <input
                        type="number"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        className="w-28 h-8 px-2.5 bg-white border border-teal-500 rounded-lg text-sm font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="0"
                        autoFocus
                      />
                      <span className="text-xs font-mono font-bold text-slate-500">₭</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {!isEditingRate ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingRate(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-teal-700 border border-teal-200 shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <PencilSimple size={13} weight="bold" />
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
                        className="h-8 px-2.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                        title="ຍົກເລີກ"
                      >
                        <X size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRate}
                        disabled={isSavingRate}
                        className="h-8 px-3 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                      >
                        <FloppyDisk size={14} weight="bold" />
                        <span>{isSavingRate ? '...' : 'ບັນທຶກ'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Master Data (Single Divided List Group) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                  <Folders size={20} weight="bold" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    ຈັດການຂໍ້ມູນຫຼັກ (Master Data)
                  </h2>
                  <p className="text-[11.5px] text-slate-500 truncate">
                    ໝວດໝູ່ສິນຄ້າ, ຜູ້ສະໜອງ ແລະ ການເພີ່ມສິນຄ້າໃໝ່
                  </p>
                </div>
              </div>

              {/* Divided List Group */}
              <div className="border border-slate-200/90 rounded-xl divide-y divide-slate-100 bg-white overflow-hidden shadow-2xs">
                {onOpenCategoryManager && (
                  <button
                    type="button"
                    onClick={onOpenCategoryManager}
                    className="w-full flex items-center justify-between p-3 sm:py-3.5 sm:px-4 hover:bg-slate-50/90 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                        <Tag size={16} weight="bold" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-[13px] font-bold text-slate-800 group-hover:text-teal-700 transition-colors block truncate">
                          ຈັດການໝວດໝູ່ສິນຄ້າ (Categories)
                        </span>
                        <p className="text-[11px] text-slate-500 truncate">
                          ເພີ່ມ, ແກ້ໄຂ ແລະ ຈັດລະບຽບກຸ່ມສິນຄ້າ
                        </p>
                      </div>
                    </div>
                    <CaretRight size={15} weight="bold" className="text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                )}

                {onOpenSupplierManager && (
                  <button
                    type="button"
                    onClick={onOpenSupplierManager}
                    className="w-full flex items-center justify-between p-3 sm:py-3.5 sm:px-4 hover:bg-slate-50/90 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                        <UsersThree size={16} weight="bold" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-[13px] font-bold text-slate-800 group-hover:text-teal-700 transition-colors block truncate">
                          ຈັດການຜູ້ສະໜອງ (Suppliers)
                        </span>
                        <p className="text-[11px] text-slate-500 truncate">
                          ລາຍຊື່ຜູ້ສະໜອງ, ເບີໂທ ແລະ ຍອດໜີ້ຄ້າງຈ່າຍ
                        </p>
                      </div>
                    </div>
                    <CaretRight size={15} weight="bold" className="text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                )}

                {onAddNewProduct && (
                  <button
                    type="button"
                    onClick={onAddNewProduct}
                    className="w-full flex items-center justify-between p-3 sm:py-3.5 sm:px-4 hover:bg-slate-50/90 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                        <Plus size={16} weight="bold" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-[13px] font-bold text-slate-800 group-hover:text-teal-700 transition-colors block truncate">
                          ເພີ່ມສິນຄ້າໃໝ່ (Add Product)
                        </span>
                        <p className="text-[11px] text-slate-500 truncate">
                          ລົງທະບຽນບາໂຄດ, ລາຄາ ແລະ 3 ລະດັບຫົວໜ່ວຍ
                        </p>
                      </div>
                    </div>
                    <CaretRight size={15} weight="bold" className="text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* RIGHT COLUMN: MÁY IN & CƠ SỞ DỮ LIỆU                              */}
          {/* ================================================================ */}
          <div className="space-y-4 sm:space-y-5">
            {/* Card 1: EasyPrint ES-8803WA Hardware Configuration */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                    <Printer size={20} weight="bold" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="truncate">ເຄື່ອງພິມ EasyPrint ES-8803WA</span>
                      <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        ESC/POS
                      </span>
                    </h2>
                    <p className="text-[11.5px] text-slate-500 truncate">
                      LAN / Wi-Fi IP (Port 9100)
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
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
                    <span>{Capacitor.isNativePlatform() ? 'Direct Socket' : 'System Print'}</span>
                  </span>
                </div>
              </div>

              {/* IP Address & Port (3-Column Grid) */}
              <div className="grid grid-cols-3 gap-2.5 mb-3.5">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    IP ເຄື່ອງພິມ LAN/Wi-Fi
                  </label>
                  <input
                    type="text"
                    value={printerIp}
                    onChange={(e) => setPrinterIp(e.target.value)}
                    placeholder="192.168.1.200"
                    className="w-full h-9 px-3 font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-2xs"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Port (RAW)
                  </label>
                  <input
                    type="number"
                    value={printerPort}
                    onChange={(e) => setPrinterPort(e.target.value)}
                    placeholder="9100"
                    className="w-full h-9 px-3 font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-2xs text-center"
                  />
                </div>
              </div>

              {/* Paper Width Options (h-14 buttons) */}
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  ຂະໜາດເຈ້ຍພິມ (Paper Width)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange(80)}
                    className={`h-14 px-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      paperWidth === 80
                        ? 'bg-teal-50 border-teal-500 text-teal-900 ring-1 ring-teal-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <span className="font-bold text-xs block truncate">80 mm (ES-8803WA)</span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        ມາດຕະຖານຕັ້ງໂຕະ (576 dots)
                      </span>
                    </div>
                    {paperWidth === 80 && (
                      <CheckCircle size={17} weight="fill" className="text-teal-600 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaperWidthChange(58)}
                    className={`h-14 px-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      paperWidth === 58
                        ? 'bg-teal-50 border-teal-500 text-teal-900 ring-1 ring-teal-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <span className="font-bold text-xs block truncate">58 mm (ພົກພາ)</span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        ເຄື່ອງພິມນ້ອຍ (384 dots)
                      </span>
                    </div>
                    {paperWidth === 58 && (
                      <CheckCircle size={17} weight="fill" className="text-teal-600 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* Hardware Toggles: Drawer Kick & Auto-Cut (Horizontal) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 cursor-pointer text-[11px] font-bold text-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={printerDrawerKick}
                    onChange={(e) => setPrinterDrawerKick(e.target.checked)}
                    className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500 accent-teal-600 shrink-0"
                  />
                  <span className="truncate">ເປີດລິ້ນຊັກເງິນ (Drawer Kick)</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 cursor-pointer text-[11px] font-bold text-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={printerAutoCut}
                    onChange={(e) => setPrinterAutoCut(e.target.checked)}
                    className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500 accent-teal-600 shrink-0"
                  />
                  <span className="truncate">ຕັດເຈ້ຍອັດຕະໂນມັດ (Auto Cut)</span>
                </label>
              </div>

              {/* Action Bar: Save & Kick Drawer Test */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTestKickDrawer}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="ທົດສອບຄຳສັ່ງເປີດລິ້ນຊັກເງິນ ESC/POS"
                >
                  <HandCoins size={14} weight="bold" />
                  <span>ທົດສອບລິ້ນຊັກ</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePrinterSettings}
                  className="h-8 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <FloppyDisk size={14} weight="bold" />
                  <span>ບັນທຶກຕັ້ງຄ່າ</span>
                </button>
              </div>
            </div>

            {/* Card 2: Supabase Status (Thanh tiện ích mỏng - Utility Bar) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-3 sm:p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {isCloudSynced ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                    <span>Online (Synced)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Offline Cache</span>
                  </span>
                )}
                <span className="text-[11px] text-slate-500 hidden sm:inline truncate">
                  Supabase Cloud
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                  {productsCount} ລາຍການ
                </span>
                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                  {transactionsCount} ບິນ
                </span>
              </div>
            </div>

            {/* Card 3: Live Update OTA (Cập nhật không cần cài lại IPA) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-4.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                    <Sparkle size={18} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        ອັບເດດແອັບອັດຕະໂນມັດ (Live OTA)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {liveUpdateInfo.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {liveUpdateInfo.isNative
                        ? 'ອັບເດດລະບົບທັນທີໂດຍບໍ່ຕ້ອງລົງແອັບ .ipa ໃໝ່ (Native Local Cache)'
                        : 'ກຳລັງເປີດຜ່ານ Web Browser'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleManualCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <DownloadSimple size={14} weight="bold" className={isCheckingUpdate ? 'animate-bounce' : ''} />
                  <span>{isCheckingUpdate ? 'ກຳລັງກວດ...' : 'ກວດສອບອັບເດດ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
