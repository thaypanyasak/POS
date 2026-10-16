import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  Lightning,
  LightningSlash,
  WarningCircle,
  Barcode,
  ArrowClockwise
} from '@phosphor-icons/react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Play high-frequency retail POS scanner beep via Web Audio API + haptic vibrate
 */
function triggerScanFeedback() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1950, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
    }
  } catch (_) {}

  try {
    if (navigator.vibrate) {
      navigator.vibrate(70);
    }
  } catch (_) {}
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'ສະແກນບາໂຄດສິນຄ້າ (Camera Barcode Scanner)',
  description = 'ສ່ອງກ້ອງຫຼັງໃສ່ບາໂຄດສິນຄ້າເພື່ອສະແກນອັດຕະໂນມັດ'
}) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);

  const scannerRef = useRef(null);
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

    // Timeout to allow the modal DOM container to render
    const timer = setTimeout(() => {
      if (!isMounted) return;
      initScanner();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (e) {
      console.warn('Error cleaning up scanner:', e);
    }
  };

  const initScanner = async () => {
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

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Ideal rectangular scanning area for horizontal retail barcodes
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const width = Math.floor(minEdge * 0.85);
          const height = Math.floor(width * 0.55); // 16:9 ratio box
          return { width, height };
        },
        aspectRatio: 1.0,
        disableFlip: true,
      };

      const onScanCallback = (decodedText) => {
        if (!decodedText) return;
        const cleaned = String(decodedText).trim();
        if (!cleaned) return;

        // Trigger audio beep & haptics
        triggerScanFeedback();
        setLastScanned(cleaned);

        // Return result to parent
        if (onScanSuccess) {
          onScanSuccess(cleaned);
        }
      };

      const qrCodeErrorCallback = () => {
        // Frame read without barcode, continue scanning
      };

      // Multi-step Camera Launch Strategy:
      // Step 1: Try environment (rear/back camera) with valid string "environment"
      let started = false;
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          onScanCallback,
          qrCodeErrorCallback
        );
        started = true;
      } catch (envErr) {
        console.warn('Environment rear camera not available, trying device camera list...', envErr);
      }

      // Step 2: If environment camera is not available (e.g. testing on laptop/PC webcam),
      // enumerate cameras and pick available camera ID
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
        } catch (camErr) {
          console.warn('Camera enumeration fallback failed, attempting user facingMode...', camErr);
        }
      }

      // Step 3: Fallback to user-facing camera
      if (!started) {
        await html5QrCode.start(
          { facingMode: 'user' },
          config,
          onScanCallback,
          qrCodeErrorCallback
        );
        started = true;
      }

      setIsInitializing(false);

      // Check for torch / flashlight support
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (_) {}
    } catch (err) {
      console.error('Failed to start barcode scanner:', err);
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
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header Bar */}
        <div className="p-3.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
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
          {/* HTML5 QR Code Mount Element */}
          <div
            id={containerId.current}
            className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          />

          {/* Aiming Reticle Overlay (Active when scanning without error) */}
          {!errorMsg && !isInitializing && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Scanning Box */}
              <div className="relative w-[78%] h-[48%] rounded-2xl border-2 border-teal-400/80 shadow-[0_0_20px_rgba(20,184,166,0.3)] flex items-center justify-center overflow-hidden">
                {/* 4 Corner Markers */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-teal-400" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-teal-400" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-teal-400" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-teal-400" />

                {/* Animated Red Laser Scan Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_#14b8a6] animate-pulse" />
              </div>

              <span className="text-[10.5px] font-bold text-white/90 bg-slate-900/70 px-3 py-1 rounded-full mt-3 backdrop-blur-xs flex items-center gap-1.5 border border-white/10">
                <Barcode size={14} weight="bold" className="text-teal-400" />
                <span>ຈັດບາໂຄດໃຫ້ຕົງກັບກອບສີ່ຫຼ່ຽມ</span>
              </span>
            </div>
          )}

          {/* Loading Camera State */}
          {isInitializing && !errorMsg && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 p-4">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-300">
                ກຳລັງເປີດກ້ອງຫຼັງ (Opening Camera)...
              </span>
            </div>
          )}

          {/* Error / Permission Denied State */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 p-5 text-center">
              <WarningCircle size={36} className="text-rose-500" weight="fill" />
              <span className="text-xs font-bold text-rose-300 max-w-[260px] leading-relaxed">
                {errorMsg}
              </span>
              <button
                type="button"
                onClick={initScanner}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95 transition-all"
              >
                <ArrowClockwise size={14} weight="bold" />
                <span>ລອງເປີດກ້ອງໃໝ່</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700/60 flex items-center justify-between gap-2">
          {/* Torch / Flashlight Button */}
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
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Camera size={13} />
              <span>ກ້ອງຫຼັງ (Rear Camera)</span>
            </div>
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
