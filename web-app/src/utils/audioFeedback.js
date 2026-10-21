/**
 * Web Audio API Sound Effects & Haptic Feedback Utility
 * High-performance, zero-latency, zero-asset audio synthesis for POS & Hardware Barcode Scanners.
 * Works seamlessly in Desktop Browsers, Mobile PWA, Capacitor & WebView without external audio files.
 */

let sharedAudioCtx = null;

// Sound Enabled Master & Granular Section Keys
const SOUND_MASTER_KEY = 'meiishop_sound_enabled';
const SOUND_SECTIONS_KEY = 'meiishop_sound_sections';

// Default configuration for each functional section
const DEFAULT_SECTIONS = {
  cart: true,         // POS & Giỏ hàng
  checkout: true,     // Thanh toán & Báo giá
  scanner: true,      // Quét mã vạch
  products: true,     // Quản lý sản phẩm
  history: true,      // Lịch sử bán hàng
  inventory: true,    // Nhập kho & NCC
  dashboard: true,    // Báo cáo Dashboard
  sales_report: true, // Số lượng bán sản phẩm
  receipt: true,      // Hóa đơn
  sidebar: true,      // Điều hướng Sidebar
  system: true,       // Thông báo hệ thống
};

let soundMasterCache = true;
let soundSectionsCache = { ...DEFAULT_SECTIONS };

if (typeof window !== 'undefined') {
  try {
    const masterStored = localStorage.getItem(SOUND_MASTER_KEY);
    soundMasterCache = masterStored !== null ? masterStored === 'true' : true;

    const sectionsStored = localStorage.getItem(SOUND_SECTIONS_KEY);
    if (sectionsStored) {
      soundSectionsCache = { ...DEFAULT_SECTIONS, ...JSON.parse(sectionsStored) };
    }
  } catch (_) {
    soundMasterCache = true;
    soundSectionsCache = { ...DEFAULT_SECTIONS };
  }
}

export function isSoundEnabled(section = null) {
  if (!soundMasterCache) return false;
  if (!section) return true;
  return soundSectionsCache[section] !== false;
}

export function setSoundEnabled(enabled) {
  soundMasterCache = Boolean(enabled);
  // When toggling master, synchronize all individual sections
  const targetState = Boolean(enabled);
  const updatedSections = {};
  Object.keys(DEFAULT_SECTIONS).forEach((key) => {
    updatedSections[key] = targetState;
  });
  soundSectionsCache = updatedSections;

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_MASTER_KEY, String(soundMasterCache));
      localStorage.setItem(SOUND_SECTIONS_KEY, JSON.stringify(soundSectionsCache));
      window.dispatchEvent(new CustomEvent('meiishop_sound_changed', {
        detail: { master: soundMasterCache, sections: soundSectionsCache }
      }));
    }
  } catch (_) {}
}

export function getSoundSections() {
  return { ...soundSectionsCache };
}

export function setSoundSectionEnabled(section, enabled) {
  soundSectionsCache = {
    ...soundSectionsCache,
    [section]: Boolean(enabled),
  };
  // If user turns on any section, ensure master is also enabled
  if (enabled && !soundMasterCache) {
    soundMasterCache = true;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SOUND_MASTER_KEY, 'true');
      }
    } catch (_) {}
  } else if (!enabled) {
    // If all sections are turned off, auto set master to false
    const anyActive = Object.values(soundSectionsCache).some(Boolean);
    if (!anyActive) {
      soundMasterCache = false;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(SOUND_MASTER_KEY, 'false');
        }
      } catch (_) {}
    }
  }

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_SECTIONS_KEY, JSON.stringify(soundSectionsCache));
      window.dispatchEvent(new CustomEvent('meiishop_sound_changed', {
        detail: { master: soundMasterCache, sections: soundSectionsCache }
      }));
    }
  } catch (_) {}
}

/**
 * Lazily retrieve or initialize a shared singleton AudioContext.
 * Handles iOS / Android WebView autoplay restrictions by resuming on interaction.
 */
function getAudioContext(section = null) {
  if (typeof window === 'undefined') return null;
  if (!isSoundEnabled(section)) return null; // Zero CPU/Audio overhead if muted

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
export function playSuccessBeep(section = 'scanner') {
  try {
    const ctx = getAudioContext(section);
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
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch (_) {}
}

/**
 * Play distinctive POS error tone (low warning buzz)
 * Tone: Dual pulse ~260Hz & 200Hz smoothed sawtooth/triangle tone, ~220ms duration
 * Haptic: Double warning buzz [100ms on, 60ms pause, 100ms on]
 */
export function playErrorBeep(section = 'system') {
  try {
    const ctx = getAudioContext(section);
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
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 60, 100]);
    }
  } catch (_) {}
}

/**
 * Play rich, satisfying chime when adding item manually to cart
 * Tone: Warm ascending dual-tone (1175Hz -> 1760Hz), rich bell envelope, ~130ms duration
 * Haptic: 45ms medium tap
 */
export function playAddToCartBeep(section = 'cart') {
  try {
    const ctx = getAudioContext(section);
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
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(45);
    }
  } catch (_) {}
}

/**
 * Play bold descending tone when removing/deleting an item from cart
 * Tone: Distinctive descending double-pop (780Hz -> 390Hz), ~150ms duration
 * Haptic: 70ms crisp tap
 */
export function playRemoveFromCartBeep(section = 'cart') {
  try {
    const ctx = getAudioContext(section);
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
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(70);
    }
  } catch (_) {}
}

/**
 * Play subtle, gentle tick when increasing or decreasing quantity
 * Tone: Soft, light, high-frequency subtle blip (2400Hz/2800Hz), ~35ms duration (non-intrusive)
 * Haptic: 15ms micro-tap
 */
export function playQuantityStepBeep(delta = 1, section = 'cart') {
  try {
    const ctx = getAudioContext(section);
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
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  } catch (_) {}
}

/**
 * Play gentle, smooth bubble tone when switching unit (Thùng / Pack / Lẻ) or Tabs
 * Tone: Smooth warm chirp (1400Hz -> 1650Hz), ~65ms duration
 * Haptic: 25ms light tap
 */
export function playUnitChangeBeep(section = 'cart') {
  try {
    const ctx = getAudioContext(section);
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
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  } catch (_) {}
}

/**
 * Play pleasant multi-tone chime when switching price tier (ລາຄາ 1, 2, 3)
 * Tone: Bright dual-tone bell (1200Hz -> 1600Hz / 1800Hz), ~90ms duration
 * Haptic: 35ms light tap
 */
export function playPriceTierBeep(section = 'cart') {
  try {
    const ctx = getAudioContext(section);
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1300, now);
      osc.frequency.exponentialRampToValueAtTime(1750, now + 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.24, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch (err) {
    console.debug('[audioFeedback] playPriceTierBeep muted:', err);
  }

  try {
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }
  } catch (_) {}
}

/**
 * Play affirmative, resonant button click chime for Quotation (ໃບບອກລາຄາ) and Checkout (ຊຳລະເງິນ)
 * Tone: Confident dual-harmonic chime (900Hz + 1350Hz), ~120ms duration
 * Haptic: 50ms firm tap
 */
export function playActionClickBeep(section = 'checkout') {
  try {
    const ctx = getAudioContext(section);
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318, now + 0.04); // E6

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    }
  } catch (err) {
    console.debug('[audioFeedback] playActionClickBeep muted:', err);
  }

  try {
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  } catch (_) {}
}

/**
 * Play soft, descending dismiss tone when closing or cancelling a modal
 * Tone: Soft falling tone (600Hz -> 360Hz), gentle volume, ~75ms duration
 * Haptic: 20ms light tap
 */
export function playModalCloseBeep(section = 'checkout') {
  try {
    const ctx = getAudioContext(section);
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.06);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (err) {
    console.debug('[audioFeedback] playModalCloseBeep muted:', err);
  }

  try {
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  } catch (_) {}
}

/**
 * Play affirmative, celebratory confirmation chime when confirming checkout / printing quotation
 * Tone: Uplifting dual-arpeggio chime (1046Hz C6 -> 1567Hz G6), ~140ms duration
 * Haptic: 60ms solid confirm tap
 */
export function playModalConfirmBeep(section = 'checkout') {
  try {
    const ctx = getAudioContext(section);
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046, now); // C6
      osc.frequency.exponentialRampToValueAtTime(1567, now + 0.05); // G6

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (err) {
    console.debug('[audioFeedback] playModalConfirmBeep muted:', err);
  }

  try {
    if (isSoundEnabled(section) && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch (_) {}
}

export default {
  isSoundEnabled,
  setSoundEnabled,
  getSoundSections,
  setSoundSectionEnabled,
  playSuccessBeep,
  playErrorBeep,
  playAddToCartBeep,
  playRemoveFromCartBeep,
  playQuantityStepBeep,
  playUnitChangeBeep,
  playPriceTierBeep,
  playActionClickBeep,
  playModalCloseBeep,
  playModalConfirmBeep,
};
