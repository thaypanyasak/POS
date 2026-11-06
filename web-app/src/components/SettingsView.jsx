import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Gear,
  CurrencyCircleDollar,
  Folders,
  UsersThree,
  Plus,
  ArrowClockwise,
  ArrowsClockwise,
  PencilSimple,
  FloppyDisk,
  X,
  Printer,
  CheckCircle,
  Tag,
  CaretRight,
  ShieldCheck,
  CloudCheck,
  CloudSlash,
  DownloadSimple,
  Sparkle,
  CircleNotch,
  RocketLaunch,
  ArrowCounterClockwise,
  SpeakerHigh,
  SpeakerSlash,
  WarningCircle,
} from '@phosphor-icons/react';
import { Capacitor } from '@capacitor/core';
import { updateExchangeRateInSupabase, updateExchangeRateAndRepriceInSupabase, supabase } from '../services/supabase';
import queryClient from '../services/queryClient';
import { formatDots } from '../utils/formatters';
import { getPrinterConfig, savePrinterConfig, fetchPrinterConfigFromDb, testPrinterConnection } from '../services/printerService';
import { liveUpdater } from '../services/liveUpdateService';
import {
  playSuccessBeep,
  playErrorBeep,
  playUnitChangeBeep,
  playRefreshBeep,
  isSoundEnabled,
  setSoundEnabled,
  getSoundSections,
  setSoundSectionEnabled,
} from '../utils/audioFeedback';

export default function SettingsView({
  exchangeRate = 0,
  setExchangeRate,
  onRepriceInPlace,
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
  const [soundActive, setSoundActive] = useState(() => isSoundEnabled());
  const [soundSections, setSoundSections] = useState(() => getSoundSections());

  useEffect(() => {
    if (exchangeRate) setRateInput(String(exchangeRate));
  }, [exchangeRate]);

  const handleToggleSound = (enabled) => {
    setSoundEnabled(enabled);
    setSoundActive(enabled);
    setSoundSections(getSoundSections());
    if (enabled) {
      playUnitChangeBeep('system');
      onAlert?.('ເປີດສຽງລະບົບ (Sound ON) ສຳເລັດແລ້ວ', 'ແຈ້ງເຕືອນ', 'success');
    } else {
      onAlert?.('ປິດສຽງລະບົບ (Sound Muted) ສຳເລັດແລ້ວ', 'ແຈ້ງເຕືອນ', 'info');
    }
  };

  const handleToggleSectionSound = (sectionKey, enabled) => {
    setSoundSectionEnabled(sectionKey, enabled);
    setSoundActive(isSoundEnabled());
    setSoundSections(getSoundSections());
    if (enabled) {
      playUnitChangeBeep('system');
    }
  };

  const [isRepriceModalOpen, setIsRepriceModalOpen] = useState(false);
  const [isApplyingReprice, setIsApplyingReprice] = useState(false);

  // HÀNH ĐỘNG 1: LƯU TỶ GIÁ THAM CHIẾU (SAVE EXCHANGE RATE ONLY)
  // Chỉ cập nhật bảng store_settings (key = 'thb_lak_exchange_rate').
  // TUYỆT ĐỐI KHÔNG can thiệp, không tính lại giá bất kỳ sản phẩm nào.
  const handleSaveRateOnly = async () => {
    const val = parseInt(rateInput, 10);
    if (!val || val <= 0) {
      onAlert?.('ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0)!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }
    setIsSavingRate(true);
    try {
      const res = await updateExchangeRateInSupabase(val);
      if (!res.success) {
        throw new Error(res.error || 'ບໍ່ສາມາດບັນທຶກອັດຕາແລກປ່ຽນໄດ້');
      }
      setExchangeRate?.(val);

      // Đồng bộ tỷ giá tham chiếu sang các thiết bị POS khác (shouldReprice: false)
      try {
        supabase.channel('pos_store_events').send({
          type: 'broadcast',
          event: 'exchange_rate_updated',
          payload: { rate: val, roundStep: 1000, shouldReprice: false },
        });
        supabase.channel('pos_price_sync').send({
          type: 'broadcast',
          event: 'exchange_rate_updated',
          payload: { rate: val, roundStep: 1000, shouldReprice: false },
        });
      } catch (broadcastErr) {
        console.warn('Realtime broadcast warning:', broadcastErr);
      }

      await queryClient.invalidateQueries({ queryKey: ['exchange_rate'] });
      await queryClient.invalidateQueries({ queryKey: ['store_settings'] });
      setIsEditingRate(false);

      playSuccessBeep();
      onAlert?.('ບັນທຶກອັດຕາແລກປ່ຽນສຳເລັດແລ້ວ', 'ສຳເລັດ', 'success');
    } catch (err) {
      playErrorBeep();
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກອັດຕາແລກປ່ຽນ', 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsSavingRate(false);
    }
  };

  // HÀNH ĐỘNG 2: NÚT ÁP DỤNG ĐỔI GIÁ HÀNG LOẠT (MANUAL BULK REPRICE TRIGGER)
  // Xác định tỷ giá sẽ áp dụng: ưu tiên rateInput nếu đang sửa, ngược lại lấy exchangeRate
  const activeTargetRate = isEditingRate && parseInt(rateInput, 10) > 0
    ? parseInt(rateInput, 10)
    : (Number(exchangeRate) || 0);

  const handleOpenRepriceModal = () => {
    if (!activeTargetRate || activeTargetRate <= 0) {
      onAlert?.('ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0) ກ່ອນດຳເນີນການ!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }
    setIsRepriceModalOpen(true);
  };

  const handleConfirmBulkReprice = async () => {
    if (!activeTargetRate || activeTargetRate <= 0) {
      onAlert?.('ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0)!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }
    setIsApplyingReprice(true);
    try {
      // 1. Gọi PostgreSQL RPC sync_exchange_rate_and_reprice (Zero-Egress Strategy < 1KB)
      const res = await updateExchangeRateAndRepriceInSupabase(activeTargetRate, 1000);
      if (!res.success && res.error) {
        throw new Error(res.error);
      }

      setExchangeRate?.(activeTargetRate);
      if (isEditingRate) {
        setIsEditingRate(false);
      }

      // 2. Local In-Place mutation trong RAM không re-fetch
      onRepriceInPlace?.(activeTargetRate, 1000);

      // 3. Realtime Broadcast cho tất cả POS đồng bộ giá mới
      try {
        supabase.channel('pos_store_events').send({
          type: 'broadcast',
          event: 'exchange_rate_updated',
          payload: { rate: activeTargetRate, roundStep: 1000, shouldReprice: true },
        });
        supabase.channel('pos_price_sync').send({
          type: 'broadcast',
          event: 'exchange_rate_updated',
          payload: { rate: activeTargetRate, roundStep: 1000, shouldReprice: true },
        });
      } catch (broadcastErr) {
        console.warn('Realtime broadcast warning:', broadcastErr);
      }

      await queryClient.invalidateQueries({ queryKey: ['exchange_rate'] });
      await queryClient.invalidateQueries({ queryKey: ['store_settings'] });
      setIsRepriceModalOpen(false);

      const updatedCount = res?.data?.updated_count || res?.data?.updated_products || 0;
      playSuccessBeep();
      onAlert?.(
        `ອັບເດດລາຄາສຳເລັດແລ້ວ ${updatedCount} ລາຍການ`,
        'ສຳເລັດ',
        'success'
      );
    } catch (err) {
      playErrorBeep();
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການປັບລາຄາສິນຄ້າ', 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsApplyingReprice(false);
    }
  };

  // Printer Settings State (LAN / Wi-Fi IP, Port - Mặc định Direct Socket 80mm ESC/POS)
  const [printerIp, setPrinterIp] = useState(() => getPrinterConfig().printer_ip || getPrinterConfig().ip || '');
  const [printerPort, setPrinterPort] = useState(() => getPrinterConfig().printer_port || getPrinterConfig().port || 9100);

  // Load shared printer config from Supabase on mount
  useEffect(() => {
    fetchPrinterConfigFromDb().then((cfg) => {
      if (cfg) {
        if (cfg.printer_ip) setPrinterIp(cfg.printer_ip);
        if (cfg.printer_port) setPrinterPort(cfg.printer_port);
      }
    }).catch(() => {});
  }, []);

  const handleSavePrinterSettings = async () => {
    const cleanIp = printerIp.trim();
    const cleanPort = parseInt(printerPort, 10) || 9100;

    await savePrinterConfig({
      printer_ip: cleanIp,
      printer_port: cleanPort,
      paper_width: paperWidth,
      auto_cut: printerAutoCut,
      drawer_kick: printerDrawerKick,
      printMethod: printerMethod,
    });

    playSuccessBeep();
    onAlert?.(
      `ບັນທຶກການຕັ້ງຄ່າເຄື່ອງພິມ ${cleanIp || '---'}:${cleanPort} ສຳເລັດ (ແບ່ງປັນກັບທຸກອຸປະກອນຜ່ານ Cloud)!`,
      'ສຳເລັດ',
      'success'
    );
  };

  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [isTestingDrawer, setIsTestingDrawer] = useState(false);

  const handleTestPrinter = async () => {
    const cleanIp = printerIp.trim();
    const cleanPort = parseInt(printerPort, 10) || 9100;

    if (!cleanIp) {
      onAlert?.('ກະລຸນາປ້ອນ IP ເຄື່ອງພິມກ່ອນທົດສອບ.', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    try {
      setIsTestingPrinter(true);

      // Auto save first to ensure current inputs are stored
      await savePrinterConfig({
        printer_ip: cleanIp,
        printer_port: cleanPort,
      });

      // Call TCP test print with timeout protection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `ໝົດເວລາເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ ${cleanIp}:${cleanPort} (Timeout 6s). ກະລຸນາກວດສອບວ່າເຄື່ອງພິມເປີດຢູ່ ແລະ ຢູ່ Wi-Fi ດຽວກັນ.`
              )
            ),
          6000
        )
      );

      const res = await Promise.race([
        testPrinterConnection(cleanIp, cleanPort),
        timeoutPromise,
      ]);

      playSuccessBeep();
      onAlert?.(res?.message || `ທົດສອບເຄື່ອງພິມ ${cleanIp}:${cleanPort} ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
    } catch (err) {
      console.error('Test printer error:', err);
      playErrorBeep();
      onAlert?.(`ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ (${cleanIp}:${cleanPort}): ${err.message}`, 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsTestingPrinter(false);
    }
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
      setIsTestingDrawer(true);
      const res = await openCashDrawerDirect();
      if (res.success) {
        playSuccessBeep();
        onAlert?.('ສົ່ງຄຳສັ່ງເປີດລິ້ນຊັກເງິນສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
      } else {
        playErrorBeep();
        onAlert?.(res.message, 'ແຈ້ງເຕືອນ', 'warning');
      }
    } catch (err) {
      playErrorBeep();
      onAlert?.(`ບໍ່ສາມາດເປີດລິ້ນຊັກ: ${err.message}`, 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsTestingDrawer(false);
    }
  };

  const [liveUpdateInfo, setLiveUpdateInfo] = useState({ version: 'ກຳລັງໂຫຼດ...', isNative: false, channel: 'production', pendingVersion: null });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [isHeaderRefreshing, setIsHeaderRefreshing] = useState(false);

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
    setDownloadProgress(null);
    try {
      const res = await liveUpdater.checkForUpdates({
        onProgress: (p) => setDownloadProgress(p.percent),
      });

      setLastCheckedTime(new Date());

      if (res && res.hasUpdate) {
        playSuccessBeep();
        onAlert?.(
          `ກວດພົບເວີຊັນໃໝ່ ${res.version}! ລະບົບກຳລັງອັບເດດ ແລະ ຣີສະຕາດແອັບທັນທີ...`,
          'ອັບເດດສຳເລັດ',
          'success'
        );
        setTimeout(async () => {
          await liveUpdater.applyUpdateAndReload(res.bundle);
        }, 1200);
      } else {
        const info = await liveUpdater.getCurrentVersion();
        setLiveUpdateInfo(info);
        playSuccessBeep();
        onAlert?.('ແອັບຂອງທ່ານເປັນເວີຊັນລ້າສຸດແລ້ວ! (ບໍ່ມີເວີຊັນໃໝ່)', 'ຂໍ້ມູນ', 'info');
      }
    } catch (e) {
      console.error('Check update error:', e);
      playErrorBeep();
      onAlert?.(`ກວດສອບອັບເດດບໍ່ສຳເລັດ: ${e.message}`, 'ແຈ້ງເຕືອນ', 'warning');
    } finally {
      setIsCheckingUpdate(false);
      setDownloadProgress(null);
    }
  };

  const handleApplyPendingUpdate = async () => {
    if (!liveUpdateInfo.pendingBundle) return;
    try {
      playSuccessBeep();
      onAlert?.('ກຳລັງເປີດໃຊ້ງານເວີຊັນໃໝ່ ແລະ ຣີສະຕາດແອັບ...', 'ອັບເດດ', 'success');
      setTimeout(async () => {
        await liveUpdater.applyUpdateAndReload(liveUpdateInfo.pendingBundle);
      }, 800);
    } catch (e) {
      playErrorBeep();
      onAlert?.(`ບໍ່ສາມາດນຳໃຊ້ເວີຊັນໃໝ່: ${e.message}`, 'ຂໍ້ຜິດພາດ', 'error');
    }
  };

  const handleQuickReload = async () => {
    await liveUpdater.reloadApp();
  };

  const handleHeaderRefresh = async () => {
    if (isHeaderRefreshing || isLoading) return;
    setIsHeaderRefreshing(true);
    playRefreshBeep('system');
    try {
      // 1. Refresh Supabase database
      if (onRefreshAll) {
        await Promise.all([
          onRefreshAll(),
          new Promise((res) => setTimeout(res, 600)),
        ]);
      }

      // 2. If on Native, also check for Capgo OTA update
      if (Capacitor.isNativePlatform()) {
        const updateRes = await liveUpdater.checkForUpdates();
        setLastCheckedTime(new Date());

        if (updateRes && updateRes.hasUpdate) {
          playSuccessBeep();
          onAlert?.(
            `ກວດພົບເວີຊັນໃໝ່ ${updateRes.version}! ລະບົບກຳລັງດາວໂຫຼດ ແລະ ຣີສະຕາດແອັບທັນທີ...`,
            'ອັບເດດສຳເລັດ',
            'success'
          );
          setTimeout(async () => {
            await liveUpdater.applyUpdateAndReload(updateRes.bundle);
          }, 1200);
          return;
        } else {
          const info = await liveUpdater.getCurrentVersion();
          setLiveUpdateInfo(info);
          playSuccessBeep();
          onAlert?.(
            `ຣີເຟຣຊຂໍ້ມູນສຳເລັດ! ແອັບຂອງທ່ານເປັນເວີຊັນລ້າສຸດແລ້ວ (v${info.version}).`,
            'ສຳເລັດ',
            'success'
          );
        }
      } else {
        playSuccessBeep();
        onAlert?.('ຣີເຟຣຊຂໍ້ມູນສິນຄ້າ ແລະ ລາຍການຂາຍສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
      }
    } catch (err) {
      console.error('Header refresh error:', err);
      playErrorBeep();
      onAlert?.(`ເກີດຂໍ້ຜິດພາດໃນການຣີເຟຣຊ: ${err.message}`, 'ແຈ້ງເຕືອນ', 'warning');
    } finally {
      setIsHeaderRefreshing(false);
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

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleHeaderRefresh}
              disabled={isLoading || isHeaderRefreshing}
              className={`group/ref p-2 sm:px-3 sm:py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-90 active:rotate-12 flex items-center gap-1.5 border border-slate-200/80 shadow-2xs ${
                isLoading || isHeaderRefreshing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              title="ໂຫຼດຂໍ້ມູນຄືນ ແລະ ກວດສອບອັບເດດເວີຊັນໃໝ່ (Refresh & Check Updates)"
            >
              <ArrowClockwise
                size={15}
                weight="bold"
                className={`transition-transform duration-300 ${isLoading || isHeaderRefreshing ? 'animate-spin text-teal-600' : 'group-hover/ref:rotate-180'}`}
              />
              <span className="hidden sm:inline">
                {isHeaderRefreshing ? 'ກຳລັງກວດສອບ...' : 'ຣີເຟຣຊ & ກວດອັບເດດ'}
              </span>
            </button>
          </div>
        </div>

        {/* 2-Column Minimal ERP Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          {/* ================================================================ */}
          {/* LEFT COLUMN: VẬN HÀNH & DỮ LIỆU GỐC                              */}
          {/* ================================================================ */}
          <div className="space-y-4 sm:space-y-5">
            {/* Card 1: Currency & Exchange Rate (ອັດຕາຕົ້ນທຶນເງິນບາດ THB / LAK - Đưa lên trên cùng) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
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

              {/* HÀNH ĐỘNG 1 & 2: KHỐI TỶ GIÁ THAM CHIẾU & ĐỒNG BỘ GIÁ BÁN (REDESIGN PHẲNG, CÂN ĐỐI 100%) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                {/* Header label & Action Edit on the same horizontal line */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    ອັດຕາແລກປ່ຽນ (1 ฿ = ... ₭)
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isEditingRate ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingRate(true)}
                        className="h-7 px-2.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <PencilSimple size={13} weight="bold" />
                        <span>ແກ້ໄຂອັດຕາ</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRateInput(String(exchangeRate));
                            setIsEditingRate(false);
                          }}
                          disabled={isSavingRate}
                          className="h-7 px-2.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                          title="ຍົກເລີກ"
                        >
                          <X size={12} weight="bold" />
                          <span>ຍົກເລີກ</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveRateOnly}
                          disabled={isSavingRate}
                          className="h-7 px-3 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                        >
                          <FloppyDisk size={13} weight="bold" />
                          <span>{isSavingRate ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Display Mode: Sleek Big Rate Value & In-Use Badge */}
                {!isEditingRate ? (
                  <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-slate-400 font-mono">1 ฿ =</span>
                      <span className="text-xl font-black font-mono text-slate-900 tracking-tight">
                        {formatDots(exchangeRate)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">₭</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ກຳລັງໃຊ້ງານ
                    </span>
                  </div>
                ) : (
                  /* Edit Mode: Integrated Input Group only, NO separate buttons underneath */
                  <div className="flex items-center bg-white rounded-xl border-2 border-blue-500 shadow-xs overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20">
                    <span className="px-3 py-2 text-xs font-bold text-slate-500 font-mono select-none bg-slate-100/70 border-r border-slate-200">
                      1 ฿ =
                    </span>
                    <input
                      type="number"
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRateOnly();
                        if (e.key === 'Escape') {
                          setRateInput(String(exchangeRate));
                          setIsEditingRate(false);
                        }
                      }}
                      className="flex-1 px-3 py-2 text-base font-black font-mono text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      autoFocus
                    />
                    <span className="px-3 py-2 text-xs font-bold text-slate-500 select-none bg-slate-100/70 border-l border-slate-200">
                      ₭
                    </span>
                  </div>
                )}

                {/* HÀNH ĐỘNG 2: NÚT ÁP DỤNG ĐỔI GIÁ HÀNG LOẠT (MÀU XANH DƯƠNG, FULL-WIDTH CÂN ĐỐI) */}
                <div className="pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={handleOpenRepriceModal}
                    disabled={isSavingRate || isApplyingReprice}
                    className="w-full h-9 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                  >
                    <ArrowsClockwise size={15} weight="bold" className={isApplyingReprice ? 'animate-spin' : ''} />
                    <span>ປັບລາຄາຂາຍສິນຄ້າທັງໝົດຕາມອັດຕານີ້</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 0: Sound & Haptic Feedback Control (Bật/Tắt âm thanh hệ thống POS) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    soundActive
                      ? 'bg-teal-50 text-teal-700 border-teal-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {soundActive ? (
                      <SpeakerHigh size={20} weight="bold" />
                    ) : (
                      <SpeakerSlash size={20} weight="bold" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <span>ສຽງລະບົບ & ສັ່ນ (Audio & Feedback)</span>
                    </h2>
                    <p className="text-[11.5px] text-slate-500 truncate">
                      ສຽງກົດປຸ່ມ, ຍິງບາໂຄດ, ປ່ຽນລາຄາ, ເລືອກຫົວໜ່ວຍ ແລະ ຊຳລະເງິນ
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    soundActive
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${soundActive ? 'bg-teal-500' : 'bg-slate-400'}`}></span>
                    <span>{soundActive ? 'ເປີດສຽງ (ON)' : 'ປິດສຽງ (Muted)'}</span>
                  </span>
                </div>
              </div>

              {/* Quick master toggle chips */}
              <div className="grid grid-cols-2 gap-2 mb-3.5">
                <button
                  type="button"
                  onClick={() => handleToggleSound(true)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                    soundActive
                      ? 'bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-500 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SpeakerHigh size={16} weight="bold" className={soundActive ? 'text-teal-700' : 'text-slate-400'} />
                    <span>ເປີດສຽງທັງໝົດ (Master ON)</span>
                  </div>
                  {soundActive && <CheckCircle size={15} weight="fill" className="text-teal-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSound(false)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                    !soundActive
                      ? 'bg-rose-50 border-rose-400 text-rose-800 ring-1 ring-rose-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SpeakerSlash size={16} weight="bold" className={!soundActive ? 'text-rose-600' : 'text-slate-400'} />
                    <span>ປິດສຽງງຽບ (Master Muted)</span>
                  </div>
                  {!soundActive && <CheckCircle size={15} weight="fill" className="text-rose-600" />}
                </button>
              </div>

              {/* Granular Section-by-Section Controls - 1 ROW 2 ITEMS TAP-TO-TOGGLE */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    ແຕະເພື່ອເປີດ / ປິດສຽງແຕ່ລະໂມດູນ:
                  </span>
                  {!soundActive && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                      Master Muted
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'cart', title: 'POS & ກະຕ່າຂາຍ' },
                    { key: 'checkout', title: 'ຊຳລະເງິນ & ໃບສະເໜີລາຄາ' },
                    { key: 'scanner', title: 'ສະແກນບາໂຄດ' },
                    { key: 'products', title: 'ຈັດການສິນຄ້າ' },
                    { key: 'history', title: 'ປະຫວັດການຂາຍ' },
                    { key: 'inventory', title: 'ຮັບເຄື່ອງ & ນຳເຂົ້າ' },
                    { key: 'dashboard', title: 'ໜ້າ Dashboard' },
                    { key: 'sales_report', title: 'ຍອດຂາຍຕາມຫົວໜ່ວຍ' },
                    { key: 'receipt', title: 'ພິມໃບບິນ' },
                    { key: 'sidebar', title: 'ແຖບເມນູຫຼັກ' },
                  ].map((sec) => {
                    const isSecEnabled = soundSections[sec.key] !== false;
                    const isEffectivelyActive = soundActive && isSecEnabled;

                    return (
                      <button
                        key={sec.key}
                        type="button"
                        onClick={() => handleToggleSectionSound(sec.key, !isSecEnabled)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 select-none active:scale-[0.98] ${
                          isEffectivelyActive
                            ? 'bg-teal-50/80 border-teal-300 text-teal-900 shadow-2xs ring-1 ring-teal-400/40'
                            : isSecEnabled
                            ? 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`text-[11.5px] sm:text-xs font-bold block truncate ${
                            isEffectivelyActive ? 'text-teal-950 font-black' : 'text-slate-700'
                          }`}>
                            {sec.title}
                          </span>
                        </div>

                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black shrink-0 tracking-tight transition-colors ${
                          isEffectivelyActive
                            ? 'bg-teal-600 text-white'
                            : isSecEnabled
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {isSecEnabled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 2: Master Data (Single Divided List Group) */}
            
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
                    placeholder="192.168.1.xxx"
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

              {/* Action Bar: Save & Test Printer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTestPrinter}
                  disabled={isTestingPrinter}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="ທົດສອບການເຊື່ອມຕໍ່ IP ເຄື່ອງພິມ"
                >
                  {isTestingPrinter ? (
                    <CircleNotch size={14} className="animate-spin text-teal-600" />
                  ) : (
                    <Printer size={14} weight="bold" />
                  )}
                  <span>{isTestingPrinter ? 'ກຳລັງທົດສອບ...' : 'ທົດສອບເຄື່ອງພິມ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePrinterSettings}
                  className="h-8 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 ml-auto"
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
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 relative overflow-hidden">
              {/* Subtle accent background glow */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3.5 relative">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
                    <Sparkle size={20} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        ອັບເດດແອັບອັດຕະໂນມັດ (Live OTA)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {liveUpdateInfo.channel || 'production'}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      ອັບເດດແອັບທັນທີຜ່ານ Cloud 
                    </p>
                  </div>
                </div>
              </div>

              {/* Version & Status Bento Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-3.5 relative">
                {/* Box 1: Current Version */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    ເວີຊັນປັດຈຸບັນ
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-sm font-black font-mono text-slate-900">
                      v{liveUpdateInfo.version}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {liveUpdateInfo.isNative ? 'Local Native Cache' : 'Web Preview'}
                  </span>
                </div>

                {/* Box 2: Cloud Sync Status */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    ສະຖານະ Cloud
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isCheckingUpdate ? (
                      <>
                        <CircleNotch size={14} className="animate-spin text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-indigo-700">ກຳລັງກວດສອບ...</span>
                      </>
                    ) : liveUpdateInfo.pendingVersion ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                        <span className="text-xs font-bold text-amber-700 truncate">
                          ພ້ອມອັບ v{liveUpdateInfo.pendingVersion}!
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} weight="fill" className="text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-700">ເວີຊັນລ້າສຸດ</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                    {lastCheckedTime ? `ກວດລ້າສຸດ: ${lastCheckedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'ກຽມພ້ອມກວດສອບ'}
                  </span>
                </div>
              </div>

              {/* Download Progress Bar if downloading */}
              {downloadProgress !== null && (
                <div className="mb-3.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900 mb-1.5">
                    <span>ກຳລັງດາວໂຫຼດເວີຊັນໃໝ່...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap relative">
                {liveUpdateInfo.pendingVersion && (
                  <button
                    type="button"
                    onClick={handleApplyPendingUpdate}
                    className="flex-1 min-w-[200px] h-9 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <RocketLaunch size={15} weight="bold" />
                    <span>ອັບເດດ & ຣີສະຕາດທັນທີ (v{liveUpdateInfo.pendingVersion})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleManualCheckUpdate}
                  disabled={isCheckingUpdate}
                  className={`h-9 px-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    liveUpdateInfo.pendingVersion
                      ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      : 'flex-1 bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white shadow-xs'
                  }`}
                >
                  {isCheckingUpdate ? (
                    <CircleNotch size={15} className="animate-spin" />
                  ) : (
                    <ArrowClockwise size={15} weight="bold" />
                  )}
                  <span>{isCheckingUpdate ? 'ກຳລັງກວດສອບ Cloud...' : 'ກວດສອບອັບເດດ (Check Updates)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickReload}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="ຣີໂຫຼດໜ້າແອັບ (Reload Webview)"
                >
                  <ArrowCounterClockwise size={14} weight="bold" />
                  <span className="hidden sm:inline">ຣີໂຫຼດແອັບ</span>
                </button>
              </div>

              
            </div>
          </div>
        </div>
      </div>

      {/* Modal Xác nhận Cập nhật giá bán toàn bộ sản phẩm (Confirmation Dialog) */}
      {isRepriceModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !isApplyingReprice && setIsRepriceModalOpen(false)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <ArrowsClockwise size={20} weight="bold" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  ຢືນຢັນການປັບລາຄາສິນຄ້າທັງໝົດ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isApplyingReprice && setIsRepriceModalOpen(false)}
                disabled={isApplyingReprice}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white/80 cursor-pointer disabled:opacity-40"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-sm text-slate-600">
              <p className="leading-relaxed">
                ລະບົບຈະຄິດໄລ່ ແລະ ປັບລາຄາຂາຍໃໝ່ສຳລັບທຸກສິນຄ້າທີ່ຜູກກັບເງິນບາດ ຕາມອັດຕາແລກປ່ຽນ <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">1 ฿ = {formatDots(activeTargetRate)} ₭</span>. ທ່ານຕ້ອງການດຳເນີນການຕໍ່ບໍ່?
              </p>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>ອັດຕາແລກປ່ຽນໃໝ່:</span>
                  <span className="font-mono font-bold text-slate-900">1 ฿ = {formatDots(activeTargetRate)} ₭</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>ຫຼັກການປັດເສດ:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    ຂັ້ນລະ 1.000 ₭ (Retail Step 1.000 ₭)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>ການປະມວນຜົນ:</span>
                  <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    Zero-Egress RPC (&lt; 1KB)
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRepriceModalOpen(false)}
                disabled={isApplyingReprice}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkReprice}
                disabled={isApplyingReprice}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isApplyingReprice ? (
                  <>
                    <CircleNotch size={14} weight="bold" className="animate-spin" />
                    <span>ກຳລັງປັບລາຄາ...</span>
                  </>
                ) : (
                  <>
                    <ArrowsClockwise size={14} weight="bold" />
                    <span>ຢືນຢັນປັບລາຄາ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
