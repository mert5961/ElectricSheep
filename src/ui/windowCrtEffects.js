const WINDOW_CRT_STYLE_ID = 'electric-sheep-window-crt-effects';

function ensureWindowCrtStyles() {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(WINDOW_CRT_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = WINDOW_CRT_STYLE_ID;
  style.textContent = `
    @keyframes electric-sheep-window-crt-scan {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }

    .electric-sheep-window-crt {
      position: fixed;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 2147483647;
      transform: translateZ(0);
    }

    .electric-sheep-window-crt::before,
    .electric-sheep-window-crt::after,
    .electric-sheep-window-crt > div {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .electric-sheep-window-crt::before {
      background:
        linear-gradient(180deg, rgba(18, 16, 16, 0) 0%, rgba(0, 0, 0, 0.16) 50%, rgba(18, 16, 16, 0) 100%),
        linear-gradient(90deg, rgba(255, 0, 0, 0.038), rgba(0, 255, 0, 0.014), rgba(0, 0, 255, 0.038));
      mix-blend-mode: screen;
      opacity: 0.8;
    }

    .electric-sheep-window-crt::after {
      background:
        radial-gradient(circle at center, transparent 50%, rgba(0, 0, 0, 0.3) 100%),
        linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0%, transparent 18%, rgba(255, 255, 255, 0.016) 46%, transparent 72%, rgba(255, 255, 255, 0.026) 100%);
      opacity: 0.78;
    }

    .electric-sheep-window-crt__glass {
      backdrop-filter: blur(0.45px) contrast(1.04) brightness(0.98) saturate(1.08);
      opacity: 0.95;
    }

    .electric-sheep-window-crt__scanlines {
      inset: -2px 0;
      background:
        repeating-linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.16) 0 1px,
          rgba(196, 255, 210, 0.035) 1px 2px,
          rgba(0, 0, 0, 0.02) 2px 3px,
          rgba(0, 0, 0, 0) 3px 4px
        ),
        linear-gradient(90deg, rgba(255, 0, 0, 0.024), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.024));
      opacity: 0.62;
    }

    .electric-sheep-window-crt__sweep {
      inset: -35% 0;
      background:
        linear-gradient(
          180deg,
          transparent 0%,
          transparent 42%,
          rgba(160, 255, 180, 0.03) 48%,
          rgba(160, 255, 180, 0.11) 50%,
          rgba(160, 255, 180, 0.03) 52%,
          transparent 58%,
          transparent 100%
        );
      opacity: 0.34;
      animation: electric-sheep-window-crt-scan 11s linear infinite;
    }

    .electric-sheep-window-crt__noise {
      background-image:
        radial-gradient(circle at 18% 22%, rgba(191, 255, 174, 0.92) 0 0.7px, transparent 0.9px),
        radial-gradient(circle at 74% 31%, rgba(191, 255, 174, 0.62) 0 0.6px, transparent 0.85px),
        radial-gradient(circle at 63% 72%, rgba(191, 255, 174, 0.54) 0 0.55px, transparent 0.85px),
        radial-gradient(circle at 29% 78%, rgba(191, 255, 174, 0.48) 0 0.5px, transparent 0.8px);
      opacity: 0.14;
    }

    @media (prefers-reduced-motion: reduce) {
      .electric-sheep-window-crt__sweep {
        animation: none;
      }

      .electric-sheep-window-crt__glass {
        backdrop-filter: none;
      }
    }
  `;
  document.head.append(style);
}

export function mountWindowCrtEffects(rootEl) {
  if (!rootEl || typeof document === 'undefined') {
    return null;
  }

  ensureWindowCrtStyles();

  const existingOverlay = rootEl.querySelector('[data-electric-sheep-window-crt="true"]');
  if (existingOverlay) {
    return existingOverlay;
  }

  if (getComputedStyle(rootEl).position === 'static') {
    rootEl.style.position = 'relative';
  }

  if (!rootEl.style.isolation) {
    rootEl.style.isolation = 'isolate';
  }

  const overlay = document.createElement('div');
  overlay.dataset.electricSheepWindowCrt = 'true';
  overlay.className = 'electric-sheep-window-crt';
  overlay.setAttribute('aria-hidden', 'true');

  const glass = document.createElement('div');
  glass.className = 'electric-sheep-window-crt__glass';

  const scanlines = document.createElement('div');
  scanlines.className = 'electric-sheep-window-crt__scanlines';

  const sweep = document.createElement('div');
  sweep.className = 'electric-sheep-window-crt__sweep';

  const noise = document.createElement('div');
  noise.className = 'electric-sheep-window-crt__noise';

  overlay.append(glass, scanlines, sweep, noise);
  rootEl.append(overlay);
  return overlay;
}
