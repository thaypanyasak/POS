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
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playSuccessBeep } from '../utils/audioFeedback';

/**
 * Triggers feedback on successful scan:
 * - On Native Capacitor: Uses Haptics.notification (Success) + Web Audio beep
 * - On Web: Uses Web Audio beep + navigator.vibrate
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

  const isNative = Capacitor.isNativePlatform();
  const scannerRef = useRef(null);
  const nativeListenerRef = useRef(null);
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

    // Launch scanner after render frame
    const timer = setTimeout(() => {
      if (!isMounted) return;
      if (isNative) {
        initNativeScanner();
      } else {
        initWebScanner();
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = async () => {
    if (isNative) {
      await cleanupNativeScanner();
    } else {
      await cleanupWebScanner();
    }
  };

  /* ========================================================================= */
  /* 1. NATIVE SCANNER (GOOGLE ML KIT: @capacitor-mlkit/barcode-scanning)       */
  /* ========================================================================= */
  const initNativeScanner = async () => {
    try {
      setIsInitializing(true);

      // Check / request native camera permission
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        const req = await BarcodeScanner.requestPermissions();
        if (req.camera !== 'granted') {
          throw new Error('PERMISSION_DENIED');
        }
      }

      // Check Google Barcode Scanner Module availability (Android Google Play Services)
      try {
        const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!isAvailable.available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      } catch (modErr) {
        console.debug('[BarcodeScanner] Google Barcode module check bypassed:', modErr);
      }

      // Check torch capability
      try {
        const torchStatus = await BarcodeScanner.isTorchAvailable();
        setHasTorch(!!torchStatus.available);
      } catch (_) {
        setHasTorch(false);
      }

      // Listen for barcode detection events
      nativeListenerRef.current = await BarcodeScanner.addListener(
        'barcodeScanned',
        async (result) => {
          const rawValue = result?.barcode?.rawValue || result?.barcode?.displayValue;
          if (!rawValue) return;
          const cleaned = String(rawValue).trim();
          if (!cleaned) return;

          await triggerScanFeedback();
          setLastScanned(cleaned);

          // Clean up native stream immediately upon successful scan
          await cleanupNativeScanner();

          if (onScanSuccess) {
            onScanSuccess(cleaned);
          }
          if (onClose) {
            onClose();
          }
        }
      );

      // Prepare DOM for transparent native camera preview
      document.body.classList.add('barcode-scanner-active');

      // Start hardware camera stream
      await BarcodeScanner.startScan({
        formats: [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.QrCode,
          BarcodeFormat.Itf
        ]
      });

      setIsInitializing(false);
    } catch (err) {
      console.error('[BarcodeScanner] Native scanner failed:', err);
      setIsInitializing(false);
      document.body.classList.remove('barcode-scanner-active');

      if (err?.message === 'PERMISSION_DENIED' || String(err).includes('denied')) {
        setErrorMsg('ແອັບຕ້ອງການສິດເຂົ້າເຖິງກ້ອງຖ່າຍຮູບ. ກະລຸນາເປີດສິດ Camera ໃນການຕັ້ງຄ່າເຄື່ອງ.');
      } else {
        setErrorMsg('ບໍ່ສາມາດເລີ່ມຕົ້ນລະບົບສະແກນ native: ' + (err?.message || String(err)));
      }
      setShowManualInput(true);
    }
  };

  const cleanupNativeScanner = async () => {
    try {
      document.body.classList.remove('barcode-scanner-active');
      if (nativeListenerRef.current) {
        await nativeListenerRef.current.remove();
        nativeListenerRef.current = null;
      }
      await BarcodeScanner.stopScan();
      setIsTorchOn(false);
    } catch (e) {
      console.debug('[BarcodeScanner] Cleanup native error:', e);
    }
  };

  const handleToggleNativeTorch = async () => {
    try {
      const nextState = !isTorchOn;
      await BarcodeScanner.setTorch({ on: nextState });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Native torch toggle error:', e);
    }
  };

  /* ========================================================================= */
  /* 2. WEB FULL-FRAME SCANNER (HTML5-QRCODE OPTIMIZED)                        */
  /* ========================================================================= */
  const initWebScanner = async () => {
    try {
      const element = document.getElementById(containerId.current);
      if (!element) return;

      const html5QrCode = new Html5Qrcode(containerId.current, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      // Full-frame detection: qrbox returns 90% of viewfinder area (near full sensor coverage)
      const config = {
        fps: 25,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Dynamic full-frame detection zone covering 90% of viewfinder
          return {
            width: Math.floor(viewfinderWidth * 0.90),
            height: Math.floor(viewfinderHeight * 0.90)
          };
        },
        aspectRatio: 1.0,
        disableFlip: true,
      };

      const onScanCallback = async (decodedText) => {
        if (!decodedText) return;
        const cleaned = String(decodedText).trim();
        if (!cleaned) return;

        await triggerScanFeedback();
        setLastScanned(cleaned);

        // Close on success
        await cleanupWebScanner();
        if (onScanSuccess) {
          onScanSuccess(cleaned);
        }
        if (onClose) {
          onClose();
        }
      };

      const qrCodeErrorCallback = () => {
        // Frame read without barcode, continue scanning
      };

      // Continuous autofocus and HD camera constraints
      const cameraConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: 'continuous' }]
      };

      let started = false;

      // Step 1: Start with high-definition rear camera constraints
      try {
        await html5QrCode.start(
          cameraConstraints,
          config,
          onScanCallback,
          qrCodeErrorCallback
        );
        started = true;
      } catch (camConstraintsErr) {
        console.warn('Direct constraints failed, trying facingMode string...', camConstraintsErr);
      }

      // Step 2: Fallback to simple { facingMode: 'environment' }
      if (!started) {
        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            onScanCallback,
            qrCodeErrorCallback
          );
          started = true;
        } catch (envErr) {
          console.warn('Environment rear camera fallback failed...', envErr);
        }
      }

      // Step 3: Enumerate camera devices and select back camera
      if (!started) {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCam = devices.find(
              (d) =>
                d.label &&
                (d.label.toLowerCase().includes('back') ||
                  d.label.toLowerCase().includes('rear') ||
                  d.label.toLowerCase().includes('environment'))
            );
            const targetCamId = backCam ? backCam.id : devices[0].id;
            await html5QrCode.start(
              targetCamId,
              config,
              onScanCallback,
              qrCodeErrorCallback
            );
            started = true;
          }
        } catch (devErr) {
          console.warn('Camera device enumeration failed...', devErr);
        }
      }

      // Step 4: Final fallback to user camera
      if (!started) {
        await html5QrCode.start(
          { facingMode: 'user' },
          config,
          onScanCallback,
          qrCodeErrorCallback
        );
        started = true;
      }

      // Enforce iOS Safari compatibility attributes on created <video>
      ensureVideoElementAttributes(containerId.current);

      setIsInitializing(false);

      // Check for flashlight support
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (_) {}
    } catch (err) {
      console.error('Failed to start web barcode scanner:', err);
      setIsInitializing(false);
      let friendly = 'ບໍ່ສາມາດເປີດກ້ອງໄດ້. ';
      if (err?.name === 'NotAllowedError' || String(err).includes('Permission')) {
        friendly += 'ກະລຸນາກວດສອບສິດການເຂົ້າເຖິງກ້ອງຖ່າຍຮູບໃນ Browser (Settings -> Allow Camera).';
      } else if (err?.name === 'NotFoundError' || String(err).includes('DevicesNotFoundError')) {
        friendly += 'ບໍ່ພົບກ້ອງຖ່າຍຮູບໃນອຸປະກອນນີ້.';
      } else {
        friendly += (err?.message || String(err));
      }
      setErrorMsg(friendly);
      setShowManualInput(true);
    }
  };

  /**
   * Helper to ensure iOS Safari plays inline without blocking
   */
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

  const cleanupWebScanner = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (e) {
      console.warn('Error cleaning up web scanner:', e);
    }
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
    if (onScanSuccess) {
      onScanSuccess(cleaned);
    }
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center p-3 animate-in fade-in duration-200 ${
        isNative ? 'bg-transparent' : 'bg-slate-950/80 backdrop-blur-sm'
      }`}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header Bar */}
        <div className="p-3.5 bg-slate-800/90 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Camera size={18} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-black text-white leading-tight">
                  {title}
                </h3>
                {isNative && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    ML Kit
                  </span>
                )}
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
          {!isNative && (
            <div
              id={containerId.current}
              className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />
          )}

          {/* Full-Frame Aiming Reticle Overlay (Active when scanning without error) */}
          {!errorMsg && !isInitializing && !showManualInput && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              {/* Responsive Full-Frame Guide (88% area, rounded, responsive) */}
              <div className="relative w-full h-full rounded-2xl border-2 border-teal-400/80 shadow-[0_0_24px_rgba(20,184,166,0.25)] flex items-center justify-center overflow-hidden">
                {/* 4 Corner Markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-teal-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-teal-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-teal-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-teal-400 rounded-br-lg" />

                {/* Animated Laser Scan Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_10px_#14b8a6] animate-pulse" />
              </div>

              {/* Status Hint */}
              <span className="absolute bottom-4 text-[10.5px] font-bold text-white/95 bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 border border-white/10 shadow-lg">
                <Barcode size={14} weight="bold" className="text-teal-400" />
                <span>ສ່ອງບາໂຄດມຸມໃດກໍ່ໄດ້ (Full-Frame Recognition)</span>
              </span>
            </div>
          )}

          {/* Loading Camera State */}
          {isInitializing && !errorMsg && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 p-4">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-300">
                {isNative ? 'ກຳລັງເປີດ ML Kit Scanner...' : 'ກຳລັງເປີດກ້ອງ (Starting Camera)...'}
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
                    if (isNative) {
                      initNativeScanner();
                    } else {
                      initWebScanner();
                    }
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
        <div className="p-3 bg-slate-800/90 border-t border-slate-700/60 flex items-center justify-between gap-2">
          {/* Torch / Flashlight Button */}
          {hasTorch ? (
            <button
              type="button"
              onClick={isNative ? handleToggleNativeTorch : handleToggleWebTorch}
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
