import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  Lightning,
  LightningSlash,
  WarningCircle,
  Barcode,
  ArrowClockwise,
  Keyboard
} from '@phosphor-icons/react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner as NativeBarcodeScanner } from 'capacitor-barcode-scanner';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import { playSuccessBeep } from '../utils/audioFeedback';

/**
 * Trigger immediate POS success beep & native haptic vibration
 */
async function triggerScanFeedback() {
  playSuccessBeep();
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      console.debug('[BarcodeScanner] Haptics error:', e);
    }
  }
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'ສະແກນບາໂຄດສິນຄ້າ (Barcode Scanner)',
  description = 'ສ່ອງກ້ອງໃສ່ບາໂຄດສິນຄ້າເພື່ອສະແກນອັດຕະໂນມັດ'
}) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const scannerRef = useRef(null);
  const isOperatingRef = useRef(false);
  const lastScannedTimeRef = useRef(0);
  const containerId = useRef(`html5qr-viewfinder-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      return;
    }

    let isMounted = true;
    setIsInitializing(true);
    setErrorMsg(null);
    setLastScanned(null);
    setIsTorchOn(false);
    setShowManualInput(false);
    setManualCode('');

    const timer = setTimeout(() => {
      if (!isMounted) return;
      initUnifiedScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = async () => {
    // Remove scanner-active transparency class from body
    if (typeof document !== 'undefined') {
      document.body.classList.remove('scanner-active', 'barcode-scanner-active');
    }

    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.debug('[BarcodeScanner] Cleanup ignored:', e);
      }
      scannerRef.current = null;
    }
    isOperatingRef.current = false;
  };

  /* ========================================================================= */
  /* UNIFIED SCANNER: THỬ NATIVE TRƯỚC, NẾU CHƯA CÓ NATIVE CHUYỂN SANG WEB      */
  /* ========================================================================= */
  const initUnifiedScanner = async () => {
    // 1. Nếu đang chạy Native Capacitor: Thử mở Native Hardware BarcodeScanner
    if (Capacitor.isNativePlatform()) {
      try {
        setIsInitializing(false);

        // Kích hoạt class trong suốt trên body để camera phần cứng hiển thị mượt mà 60 FPS
        document.body.classList.add('scanner-active', 'barcode-scanner-active');

        const scanResult = await NativeBarcodeScanner.scan();

        document.body.classList.remove('scanner-active', 'barcode-scanner-active');

        if (scanResult && scanResult.result && scanResult.code) {
          const cleaned = String(scanResult.code).trim();
          if (cleaned) {
            // Debounce check
            const now = Date.now();
            if (now - lastScannedTimeRef.current > 800) {
              lastScannedTimeRef.current = now;
              await triggerScanFeedback();
              setLastScanned(cleaned);
              if (onScanSuccess) onScanSuccess(cleaned);
              if (onClose) onClose();
              return;
            }
          }
        }
        // User cancel/back
        if (onClose) onClose();
        return;
      } catch (err) {
        document.body.classList.remove('scanner-active', 'barcode-scanner-active');
        const errString = String(err?.message || err);
        console.warn('[BarcodeScanner] Native scanner failed or not installed:', errString);

        if (errString.includes('cancel') || errString.includes('user')) {
          if (onClose) onClose();
          return;
        }
        if (errString.includes('Permission') || errString.includes('denied')) {
          setErrorMsg('ແອັບຕ້ອງການສິດເຂົ້າເຖິງກ້ອງຖ່າຍຮູບ. ກະລຸນາເປີດສິດ Camera ໃນ Settings.');
          setShowManualInput(true);
          return;
        }
        // Fallback sang Web Full-Frame Scanner
      }
    }

    // 2. Mở Web Camera Full-Frame Scanner
    await startWebCameraScanner();
  };

  /* ========================================================================= */
  /* 2. WEB FULL-FRAME SCANNER (TỐC ĐỘ CAO, QUÉT TOÀN BỘ KHUNG HÌNH 95%)        */
  /* ========================================================================= */
  const startWebCameraScanner = async () => {
    if (isOperatingRef.current) return;
    isOperatingRef.current = true;
    setIsInitializing(true);
    setErrorMsg(null);

    try {
      await cleanupScanner();
      isOperatingRef.current = true;

      const element = document.getElementById(containerId.current);
      if (!element) {
        isOperatingRef.current = false;
        setIsInitializing(false);
        return;
      }

      // Giới hạn định dạng phổ biến nhất để tối ưu hoá decode tốc độ cực nhanh (< 0.1s)
      const html5QrCode = new Html5Qrcode(containerId.current, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      // Full-Frame 95% diện tích: Quét nhạy mọi góc độ, không cần căn ô vuông
      const config = {
        fps: 25,
        qrbox: (viewfinderWidth, viewfinderHeight) => ({
          width: Math.floor(viewfinderWidth * 0.95),
          height: Math.floor(viewfinderHeight * 0.95)
        }),
        aspectRatio: 1.0,
        disableFlip: true,
      };

      const onScanCallback = async (decodedText) => {
        if (!decodedText) return;
        const cleaned = String(decodedText).trim();
        if (!cleaned) return;

        // Debounce 800ms
        const now = Date.now();
        if (now - lastScannedTimeRef.current < 800) {
          return;
        }
        lastScannedTimeRef.current = now;

        // Feedback tức thì & đóng ngay
        await triggerScanFeedback();
        setLastScanned(cleaned);

        await cleanupScanner();
        if (onScanSuccess) onScanSuccess(cleaned);
        if (onClose) onClose();
      };

      const qrCodeErrorCallback = () => {};

      // Cấu hình Camera HD 720p tối ưu cho thuật toán Web: nhẹ CPU hơn 1080p, tốc độ giải mã tăng gấp 2 lần
      const cameraConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        advanced: [
          { focusMode: 'continuous' }
        ]
      };

      let started = false;

      try {
        await html5QrCode.start(
          cameraConstraints,
          config,
          onScanCallback,
          qrCodeErrorCallback
        );
        started = true;
      } catch (camErr) {
        console.warn('[BarcodeScanner] HD constraints fallback to simple environment:', camErr);
      }

      if (!started) {
        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          onScanCallback,
          qrCodeErrorCallback
        );
        started = true;
      }

      // Đảm bảo cờ video bắt buộc cho iOS Safari / WebKit không bị chặn
      ensureVideoElementAttributes(containerId.current);
      setIsInitializing(false);
      isOperatingRef.current = false;

      // Kiểm tra đèn Flash
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (_) {}
    } catch (err) {
      console.error('[BarcodeScanner] Web Camera start error:', err);
      setIsInitializing(false);
      isOperatingRef.current = false;

      let friendly = 'ບໍ່ສາມາດເປີດກ້ອງໄດ້: ';
      if (err?.name === 'NotAllowedError' || String(err).includes('Permission')) {
        friendly = 'ແອັບຕ້ອງການສິດເຂົ້າເຖິງກ້ອງຖ່າຍຮູບ. ກະລຸນາເປີດສິດ Camera ໃນ Settings.';
      } else if (err?.name === 'NotFoundError' || String(err).includes('DevicesNotFoundError')) {
        friendly = 'ບໍ່ພົບກ້ອງຖ່າຍຮູບໃນອຸປະກອນນີ້.';
      } else {
        friendly += (err?.message || String(err));
      }
      setErrorMsg(friendly);
      setShowManualInput(true);
    }
  };

  const ensureVideoElementAttributes = (elementId) => {
    try {
      const parent = document.getElementById(elementId);
      if (!parent) return;
      const video = parent.querySelector('video');
      if (video) {
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.autoplay = true;
      }
    } catch (_) {}
  };

  const handleToggleWebTorch = async () => {
    try {
      if (!scannerRef.current || !hasTorch) return;
      const nextState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Web torch toggle error:', e);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const cleaned = manualCode.trim();
    if (!cleaned) return;
    triggerScanFeedback();
    if (onScanSuccess) onScanSuccess(cleaned);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header Bar */}
        <div className="p-3.5 bg-slate-800/95 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Camera size={18} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-black text-white leading-tight">
                  {title}
                </h3>
              </div>
              <p className="text-[10px] text-slate-400">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Viewfinder Camera Area */}
        <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
          {/* Web HTML5 QR Code Mount Element */}
          <div
            id={containerId.current}
            className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          />

          {/* Full-Frame Aiming Reticle Overlay (95% detection zone, zero friction) */}
          {!errorMsg && !isInitializing && !showManualInput && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
              <div className="relative w-full h-full rounded-2xl border-2 border-teal-400/80 shadow-[0_0_24px_rgba(20,184,166,0.25)] flex items-center justify-center overflow-hidden">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-teal-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-teal-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-teal-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-teal-400 rounded-br-lg" />

                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_10px_#14b8a6] animate-pulse" />
              </div>

              <span className="absolute bottom-4 text-[10.5px] font-bold text-white/95 bg-slate-900/85 px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 border border-white/10 shadow-lg">
                <Barcode size={14} weight="bold" className="text-teal-400" />
                <span>ສ່ອງບາໂຄດມຸມໃດກໍ່ໄດ້ (Full-Frame Detection)</span>
              </span>
            </div>
          )}

          {/* Loading Camera State */}
          {isInitializing && !errorMsg && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 p-4">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-300">
                ກຳລັງເປີດກ້ອງ (Starting Camera)...
              </span>
            </div>
          )}

          {/* Error / Permission Denied State or Manual Fallback View */}
          {(errorMsg || showManualInput) && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 p-5 text-center">
              {errorMsg && (
                <>
                  <WarningCircle size={36} className="text-rose-500" weight="fill" />
                  <span className="text-xs font-bold text-rose-300 max-w-[260px] leading-relaxed">
                    {errorMsg}
                  </span>
                </>
              )}

              {/* Fallback Manual Input Form */}
              <form onSubmit={handleManualSubmit} className="w-full max-w-[260px] flex flex-col gap-2 mt-1">
                <div className="text-[11px] font-bold text-slate-300 flex items-center justify-center gap-1">
                  <Keyboard size={14} className="text-teal-400" />
                  <span>ປ້ອນລະຫັດບາໂຄດດ້ວຍຕົນເອງ:</span>
                </div>
                <input
                  type="text"
                  autoFocus
                  placeholder="ລະຫັດບາໂຄດ (Barcode)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-center text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="w-full py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  ຢືນຢັນບາໂຄດ (Confirm)
                </button>
              </form>

              {errorMsg && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setShowManualInput(false);
                    startWebCameraScanner();
                  }}
                  className="mt-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer transition-all"
                >
                  <ArrowClockwise size={13} weight="bold" />
                  <span>ລອງໃໝ່ອີກຄັ້ງ</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-3 bg-slate-800/95 border-t border-slate-700/60 flex items-center justify-between gap-2">
          {hasTorch ? (
            <button
              type="button"
              onClick={handleToggleWebTorch}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                  : 'bg-slate-700/80 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isTorchOn ? <LightningSlash size={15} weight="fill" /> : <Lightning size={15} weight="fill" />}
              <span>{isTorchOn ? 'ປິດໄຟ Flash' : 'ເປີດໄຟ Flash'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Keyboard size={14} />
              <span>{showManualInput ? 'ເປີດກ້ອງ' : 'ປ້ອນເລກເອງ'}</span>
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            ປິດ (Close)
          </button>
        </div>

        {/* Last scanned notice */}
        {lastScanned && (
          <div className="bg-teal-600 px-3 py-1.5 text-center text-[10.5px] font-mono font-bold text-white flex items-center justify-center gap-1">
            <span>ສະແກນໄດ້:</span>
            <strong className="underline tracking-wider">{lastScanned}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
