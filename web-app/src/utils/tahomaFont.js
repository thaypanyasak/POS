/**
 * Offline Tahoma font loader for Vietnamese receipts
 * Ensures Tahoma is loaded in document.fonts across all platforms (Android, iOS, Windows, Sunmi)
 */

let tahomaLoadedPromise = null;

export async function ensureTahomaLoaded() {
  if (typeof document === 'undefined') return;
  if (tahomaLoadedPromise) return tahomaLoadedPromise;

  tahomaLoadedPromise = (async () => {
    try {
      // 1. Inject @font-face style if not already present
      if (!document.getElementById('tahoma-local-style')) {
        const style = document.createElement('style');
        style.id = 'tahoma-local-style';
        style.textContent = `
          @font-face {
            font-family: 'Tahoma';
            font-style: normal;
            font-weight: 400;
            font-display: swap;
            src: url('/fonts/tahoma.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Tahoma';
            font-style: normal;
            font-weight: 700;
            font-display: swap;
            src: url('/fonts/tahomabd.ttf') format('truetype');
          }
        `;
        document.head.appendChild(style);
      }

      // 2. Load via FontFace API for instant canvas availability
      if (document.fonts && typeof FontFace !== 'undefined') {
        const tRegular = new FontFace('Tahoma', 'url(/fonts/tahoma.ttf)', { weight: '400', style: 'normal' });
        const tBold = new FontFace('Tahoma', 'url(/fonts/tahomabd.ttf)', { weight: '700', style: 'normal' });

        const faces = await Promise.all([
          tRegular.load().catch((e) => { console.warn('Tahoma regular load error:', e); return null; }),
          tBold.load().catch((e) => { console.warn('Tahoma bold load error:', e); return null; }),
        ]);

        faces.forEach((f) => {
          if (f) document.fonts.add(f);
        });

        await document.fonts.ready;
      }
    } catch (err) {
      console.warn('[tahomaFont] Load notice:', err);
    }
  })();

  return tahomaLoadedPromise;
}
