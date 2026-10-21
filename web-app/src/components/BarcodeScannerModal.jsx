import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  Lightning,
  LightningSlash,
  WarningCircle,
  Barcode,
  ArrowClockwise,
  Keyboard,
  ArrowsClockwise
} from '@phosphor-icons/react';
import { Capacitor } from '@capacitor/core';
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
  description = 'ວາງບາໂຄດໃຫ້ຕົງກັບກອບສີ່ຫຼ່ຽມເພື່ອສະແກນອັດຕະໂນມັດ'
}) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);

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
    setFocusPoint(null);
    // Assign fresh unique container ID for this modal session
    containerId.current = `html5qr-viewfinder-${Math.random().toString(36).slice(2, 8)}`;

    // Short delay to ensure modal DOM is mounted and painted
    const timer = setTimeout(() => {
      if (!isMounted) return;
      startEmbeddedScanner();
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        const state = scanner.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scanner.stop();
        }
      } catch (e) {
        console.debug('[BarcodeScanner] Stop error ignored:', e);
      }
      try {
        scanner.clear();
      } catch (e) {
        console.debug('[BarcodeScanner] Clear error ignored:', e);
      }
    }

    // Clean DOM node if present
    try {
      const el = document.getElementById(containerId.current);
      if (el) el.innerHTML = '';
    } catch (_) {}

    isOperatingRef.current = false;
  };

  /**
   * Starts high-speed embedded scanner with focused reticle region
   */
  const startEmbeddedScanner = async (overrideCameraId = null) => {
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

      // 1. Enumerate and discover cameras on device/browser
      let chosenCameraId = overrideCameraId;
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
          if (!chosenCameraId) {
            // Mobile/Tablet: Prefer rear/back camera
            const backCam = cameras.find(c => /back|rear|environment|sau|หลัง/i.test(c.label));
            // Laptop/Desktop/Unknown: Fallback to last or first available camera
            chosenCameraId = backCam ? backCam.id : (cameras[cameras.length - 1]?.id || cameras[0].id);
          }
        }
      } catch (enumErr) {
        console.warn('[BarcodeScanner] getCameras discovery error:', enumErr);
      }

      setActiveCameraId(chosenCameraId);

      // Target camera: specific deviceId if discovered, or environment fallback
      const cameraTarget = chosenCameraId ? chosenCameraId : { facingMode: 'environment' };

      // 2. Instantiate a fresh Html5Qrcode instance with targetedFormats:
      // Strictly restricted to EAN-13, EAN-8, CODE-128, UPC-A, and QR_CODE for maximum decode speed & accuracy
      const html5QrCode = new Html5Qrcode(containerId.current, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      // 3. Ultra-wide 90-95% full-frame scanning area for effortless scanning from 20-40cm
      const config = {
        fps: 25,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const w = Math.floor(viewfinderWidth * 0.92);
          const h = Math.floor(viewfinderHeight * 0.75);
          return {
            width: Math.max(220, w),
            height: Math.max(160, h),
          };
        },
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

        // Feedback & clean close
        await triggerScanFeedback();
        setLastScanned(cleaned);

        await cleanupScanner();
        if (onScanSuccess) onScanSuccess(cleaned);
        if (onClose) onClose();
      };

      const qrCodeErrorCallback = () => {};

      // 4. Start camera feed directly on the chosen camera device
      await html5QrCode.start(
        cameraTarget,
        config,
        onScanCallback,
        qrCodeErrorCallback
      );

      ensureVideoElementAttributes(containerId.current);

      // 5. Fine-tune continuous auto focus & auto-zoom (20-40cm distance) if supported
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities?.() || {};
        const constraints = {
          advanced: [{ focusMode: 'continuous' }]
        };
        // If zoom is supported, apply slight optical zoom for 20-40cm reading
        if (capabilities.zoom && capabilities.zoom.min !== undefined && capabilities.zoom.max !== undefined) {
          const optimalZoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, 1.25));
          constraints.advanced.push({ zoom: optimalZoom });
        }
        await html5QrCode.applyVideoConstraints(constraints);
      } catch (_) {}

      // 6. Check for flashlight / torch support
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (_) {}

      setIsInitializing(false);
      isOperatingRef.current = false;
    } catch (err) {
      console.error('[BarcodeScanner] Camera start error:', err);
      await cleanupScanner();
      setIsInitializing(false);
      isOperatingRef.current = false;

      let friendly = 'ບໍ່ສາມາດເປີດກ້ອງໄດ້: ';
      if (err?.name === 'NotAllowedError' || String(err).includes('Permission') || String(err).includes('denied')) {
        friendly = 'ແອັບຕ້ອງການສິດເຂົ້າເຖິງກ້ອງຖ່າຍຮູບ. ກະລຸນາເປີດສິດ Camera ໃນ Browser/Settings.';
      } else if (err?.name === 'NotFoundError' || String(err).includes('DevicesNotFoundError') || String(err).includes('No cameras')) {
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

  const handleToggleTorch = async () => {
    try {
      if (!scannerRef.current || !hasTorch) return;
      const nextState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  const handleSwitchCamera = async () => {
    if (availableCameras.length < 2 || isOperatingRef.current) return;
    const currentIndex = availableCameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    if (nextCamera) {
      await startEmbeddedScanner(nextCamera.id);
    }
  };

  const handleTapViewfinder = async (e) => {
    if (showManualInput || errorMsg || isInitializing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setFocusPoint({ x, y, id: Date.now() });
    setTimeout(() => {
      setFocusPoint(null);
    }, 800);

    // Re-lock continuous autofocus
    try {
      if (scannerRef.current) {
        await scannerRef.current.applyVideoConstraints({
          advanced: [
            { focusMode: 'continuous' }
          ]
        });
      }
    } catch (_) {}
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
    <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header Bar */}
        <div className="p-3.5 bg-slate-800/95 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Camera size={18} weight="bold" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white leading-tight">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400">
                {description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Camera Switch button if multiple cameras available */}
            {availableCameras.length > 1 && !errorMsg && !showManualInput && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                title="ປ່ຽນກ້ອງຖ່າຍຮູບ (Switch Camera)"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer"
              >
                <ArrowsClockwise size={18} weight="bold" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Viewfinder Camera Area with tap-to-focus */}
        <div
          onClick={handleTapViewfinder}
          className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden cursor-crosshair select-none"
        >
          {/* HTML5 QR Code Mount Element */}
          <div
            id={containerId.current}
            className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          />

          {/* Aiming Reticle Framing Box - Expanded Full-Frame Recognition Zone (90-95%) */}
          {!errorMsg && !isInitializing && !showManualInput && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
              {/* Outer Shadow Mask creates dark cutout with crisp transparent center reticle */}
              <div
                className="relative w-[92%] h-[72%] rounded-2xl border-2 border-teal-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.55),0_0_24px_rgba(20,184,166,0.35)] flex items-center justify-center overflow-hidden"
              >
                {/* 4 High-Visibility Rounded Corner Accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-teal-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-teal-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-teal-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-teal-400 rounded-br-xl" />

                {/* Subtle Center Focus Target */}
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400/60 shadow-[0_0_6px_#2dd4bf]" />

                {/* Animated Red Laser Scan Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-barcode-laser" />
              </div>

              {/* Barcode Alignment Guide */}
              <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-white/10 rounded-full text-white/95 text-[11px] font-bold shadow-lg backdrop-blur-md">
                <Barcode size={15} weight="bold" className="text-teal-400" />
                <span>ພື້ນທີ່ສະແກນເຕັມຈໍ (ໄລຍະ 20-40cm)</span>
              </div>
            </div>
          )}

          {/* Interactive Tap-to-Focus Ring Indicator */}
          {focusPoint && (
            <div
              className="absolute pointer-events-none w-12 h-12 border-2 border-amber-400 rounded-xl shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-focus-ring z-20 flex items-center justify-center"
              style={{ left: focusPoint.x, top: focusPoint.y }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
          )}

          {/* Loading Camera State */}
          {isInitializing && !errorMsg && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 p-4 z-10">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-300">
                ກຳລັງເປີດກ້ອງ (Starting Camera)...
              </span>
            </div>
          )}

          {/* Error / Permission Denied State or Manual Fallback View */}
          {(errorMsg || showManualInput) && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 p-5 text-center z-10">
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
                    startEmbeddedScanner();
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
              onClick={handleToggleTorch}
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
