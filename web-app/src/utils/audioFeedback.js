/**
 * Web Audio API Sound Effects & Haptic Feedback Utility
 * High-performance, zero-latency, zero-asset audio synthesis for POS & Hardware Barcode Scanners.
 * Works seamlessly in Desktop Browsers, Mobile PWA, Capacitor & WebView without external audio files.
 */

let sharedAudioCtx = null;

/**
 * Lazily retrieve or initialize a shared singleton AudioContext.
 * Handles iOS / Android WebView autoplay restrictions by resuming on interaction.
 */
function getAudioContext() {
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch (err) {
    console.warn('[audioFeedback] Failed to initialize AudioContext:', err);
    return null;
  }
}

// Global user gesture listener to unlock AudioContext on first touch / click / key
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (_) {}
    window.removeEventListener('pointerdown', unlockAudio, true);
    window.removeEventListener('keydown', unlockAudio, true);
    window.removeEventListener('touchstart', unlockAudio, true);
  };

  window.addEventListener('pointerdown', unlockAudio, { capture: true, once: true });
  window.addEventListener('keydown', unlockAudio, { capture: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { capture: true, once: true });
}

/**
 * Play standard POS retail scanner high-frequency success chime
 * Tone: Crisp 1950Hz - 2200Hz sine wave, ~95ms duration, smooth exponential decay
 * Haptic: 60ms subtle vibration
 */
export function playSuccessBeep() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Dual-tone retail register chime: 1850Hz jumping up to 2100Hz
      osc.frequency.setValueAtTime(1850, now);
      osc.frequency.exponentialRampToValueAtTime(2150, now + 0.035);

      // Attack & smooth exponential decay (prevents clicks)
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (err) {
    console.debug('[audioFeedback] playSuccessBeep muted:', err);
  }

  // Haptic feedback
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch (_) {}
}

/**
 * Play distinctive POS error tone (low warning buzz)
 * Tone: Dual pulse ~260Hz & 200Hz smoothed sawtooth/triangle tone, ~220ms duration
 * Haptic: Double warning buzz [100ms on, 60ms pause, 100ms on]
 */
export function playErrorBeep() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      // Low descending buzz
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(190, now + 0.22);

      // Lowpass filter to soften the harshness of sawtooth wave
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      // Dual-buzz volume envelope
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.20, now + 0.11);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.24);
    }
  } catch (err) {
    console.debug('[audioFeedback] playErrorBeep muted:', err);
  }

  // Haptic feedback
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 60, 100]);
    }
  } catch (_) {}
}

/**
 * Play rich, satisfying chime when adding item manually to cart
 * Tone: Warm ascending dual-tone (1175Hz -> 1760Hz), rich bell envelope, ~130ms duration
 * Haptic: 45ms medium tap
 */
export function playAddToCartBeep() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Richer, warm acoustic tone
      osc.frequency.setValueAtTime(1175, now); // D6
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05); // A6

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    }
  } catch (err) {
    console.debug('[audioFeedback] playAddToCartBeep muted:', err);
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(45);
    }
  } catch (_) {}
}

/**
 * Play bold descending tone when removing/deleting an item from cart
 * Tone: Distinctive descending double-pop (780Hz -> 390Hz), ~150ms duration
 * Haptic: 70ms crisp tap
 */
export function playRemoveFromCartBeep() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.exponentialRampToValueAtTime(390, now + 0.12);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    }
  } catch (err) {
    console.debug('[audioFeedback] playRemoveFromCartBeep muted:', err);
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(70);
    }
  } catch (_) {}
}

/**
 * Play subtle, gentle tick when increasing or decreasing quantity
 * Tone: Soft, light, high-frequency subtle blip (2400Hz/2800Hz), ~35ms duration (non-intrusive)
 * Haptic: 15ms micro-tap
 */
export function playQuantityStepBeep(delta = 1) {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const baseFreq = delta >= 0 ? 2400 : 1900;
      const targetFreq = delta >= 0 ? 2800 : 1600;

      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.025);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.003); // Soft volume
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (err) {
    console.debug('[audioFeedback] playQuantityStepBeep muted:', err);
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  } catch (_) {}
}

/**
 * Play gentle, smooth bubble tone when switching unit (Thùng / Pack / Lẻ)
 * Tone: Smooth warm chirp (1400Hz -> 1650Hz), ~65ms duration
 * Haptic: 25ms light tap
 */
export function playUnitChangeBeep() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1350, now);
      osc.frequency.exponentialRampToValueAtTime(1750, now + 0.045);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    }
  } catch (err) {
    console.debug('[audioFeedback] playUnitChangeBeep muted:', err);
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  } catch (_) {}
}

export default {
  playSuccessBeep,
  playErrorBeep,
  playAddToCartBeep,
  playRemoveFromCartBeep,
  playQuantityStepBeep,
  playUnitChangeBeep,
};
