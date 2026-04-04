const OPERATOR_STYLE_ID = 'electric-sheep-shader-operator-styles';

export function ensureOperatorWorkspaceStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(OPERATOR_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = OPERATOR_STYLE_ID;
  style.textContent = `
    .es-shader-tab {
      --crt-bg: var(--es-bg);
      --crt-bg-2: var(--es-bg-deep);
      --crt-panel: rgba(5, 12, 5, 0.84);
      --crt-line-dim: rgba(51, 255, 51, 0.06);
      --crt-line: rgba(51, 255, 51, 0.14);
      --crt-line-strong: rgba(51, 255, 51, 0.24);
      --crt-text-dim: rgba(62, 167, 59, 0.72);
      --crt-text: rgba(117, 247, 107, 0.86);
      --crt-text-strong: rgba(155, 255, 143, 0.96);
      --crt-accent: var(--es-accent);
      --crt-accent-warm: var(--es-accent-strong);
      --crt-glow-soft: 0 0 8px rgba(51, 255, 51, 0.08);
      --crt-glow: 0 0 18px rgba(51, 255, 51, 0.16);
      --crt-inset-shadow:
        inset 0 0 0 1px var(--crt-line),
        inset 0 0 28px rgba(0, 0, 0, 0.38),
        inset 0 0 80px rgba(30, 120, 40, 0.05);
      --es-bg: var(--crt-bg);
      --es-panel: var(--crt-panel);
      --es-panel-2: rgba(10, 32, 16, 0.92);
      --es-line-dim: var(--crt-line-dim);
      --es-line: var(--crt-line);
      --es-line-strong: var(--crt-line-strong);
      --es-text-dim: var(--crt-text-dim);
      --es-text: var(--crt-text);
      --es-text-strong: var(--crt-text-strong);
      --es-accent: var(--crt-accent);
      --es-accent-2: var(--crt-accent-warm);
      --es-glow-soft: var(--crt-glow-soft);
      --es-glow: var(--crt-glow);
      display: grid;
      gap: 14px;
      color: var(--es-text);
      font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }

    .es-machine-panel {
      position: relative;
      isolation: isolate;
      padding: 12px;
      border: 1px solid rgba(51, 255, 51, 0.08);
      border-radius: 0;
      background:
        radial-gradient(circle at center, rgba(51, 255, 51, 0.016), transparent 62%),
        linear-gradient(180deg, rgba(8, 20, 10, 0.42) 0%, rgba(4, 12, 6, 0.22) 100%);
      box-shadow:
        inset 0 0 20px rgba(0, 0, 0, 0.14),
        var(--es-glow-soft);
      overflow: hidden;
      animation: es-border-hum 6.4s ease-in-out infinite;
    }

    .es-machine-panel::before {
      content: "";
      pointer-events: none;
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          to bottom,
          rgba(190, 255, 200, 0.02) 0px,
          rgba(190, 255, 200, 0.02) 1px,
          rgba(0, 0, 0, 0) 2px,
          rgba(0, 0, 0, 0) 4px
        ),
        linear-gradient(180deg, rgba(180, 255, 190, 0.018), transparent 34%);
      mix-blend-mode: screen;
      opacity: 0.07;
    }

    .es-machine-panel::after {
      content: "";
      pointer-events: none;
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 15% 18%, rgba(191, 255, 174, 0.14) 0 0.6px, transparent 0.8px),
        radial-gradient(circle at 78% 28%, rgba(191, 255, 174, 0.1) 0 0.55px, transparent 0.8px),
        radial-gradient(circle at 61% 74%, rgba(191, 255, 174, 0.08) 0 0.5px, transparent 0.8px);
      opacity: 0.07;
      background-repeat: repeat, repeat, repeat;
    }

    .es-machine-panel > * {
      position: relative;
      z-index: 1;
    }

    .es-workspace-card {
      min-width: 0;
      gap: 10px;
    }

    .es-workspace-card h3,
    .es-workspace-card label,
    .es-workspace-card p {
      text-shadow: 0 0 6px rgba(51, 255, 51, 0.08);
    }

    .es-workspace-card input,
    .es-workspace-card select,
    .es-dev-panel input,
    .es-dev-panel select {
      box-shadow:
        inset 0 0 0 1px rgba(190, 255, 200, 0.03),
        inset 0 0 18px rgba(0, 0, 0, 0.24),
        0 0 10px rgba(51, 255, 51, 0.04);
      text-shadow: 0 0 6px rgba(51, 255, 51, 0.08);
    }

    .es-operator-modebar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 8px 12px;
    }

    .es-operator-modebar h3,
    .es-dev-panel h3 {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--es-text-strong);
    }

    .es-shader-modebar__copy,
    .es-shader-modebar__actions {
      display: grid;
      gap: 4px;
    }

    .es-shader-modebar__actions {
      justify-items: end;
    }

    .es-shader-modebar__title {
      margin: 0;
    }

    .es-shader-modebar__meta,
    .es-shader-modebar__hint {
      margin: 0;
      font-size: 10px;
      color: var(--es-text-dim);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .es-operator-modebar p,
    .es-dev-panel p {
      margin: 0;
      font-size: 11px;
      line-height: 1.45;
      color: var(--es-text-dim);
    }

    .es-operator-strip {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: center;
      min-width: 0;
      padding: 0 0 6px;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    .es-operator-strip__left,
    .es-operator-strip__right {
      display: flex;
      align-items: center;
      gap: 18px;
      min-width: 0;
    }

    .es-operator-strip__left {
      overflow: hidden;
    }

    .es-operator-strip__group {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      white-space: nowrap;
    }

    .es-operator-strip__group--surfaces {
      flex: 1 1 auto;
      min-width: 0;
    }

    .es-operator-strip__label {
      color: var(--es-muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .es-operator-strip__value {
      color: var(--es-text-strong);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .es-operator-strip__surfaces {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .es-operator-strip__surface {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      min-height: 24px;
      padding: 4px 8px;
      border: 1px solid transparent;
      background: transparent;
      color: rgba(117, 247, 107, 0.42);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-family: var(--es-font);
      cursor: pointer;
      transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s;
      box-shadow: none;
    }

    .es-operator-strip__surface:hover:not(:disabled) {
      background: rgba(51, 255, 51, 0.05);
      color: var(--es-text);
    }

    .es-operator-strip__surface[data-assigned="true"] {
      color: rgba(117, 247, 107, 0.8);
    }

    .es-operator-strip__surface[data-selected="true"] {
      border-color: rgba(51, 255, 51, 0.34);
      background: rgba(51, 255, 51, 0.14);
      color: var(--es-text-strong);
      box-shadow: 0 0 12px rgba(51, 255, 51, 0.08);
    }

    .es-operator-strip__state {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--es-text);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .es-operator-strip__state-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: rgba(62, 167, 59, 0.5);
      box-shadow: none;
      flex-shrink: 0;
    }

    .es-operator-strip__state[data-status="live"] .es-operator-strip__state-dot {
      background: rgb(51 255 51);
      box-shadow: 0 0 10px rgba(51, 255, 51, 0.26);
    }

    .es-operator-strip__state[data-status="wait"] .es-operator-strip__state-dot {
      background: #9bff8f;
      box-shadow: 0 0 10px rgba(155, 255, 143, 0.22);
    }

    .es-operator-strip__state[data-status="error"] .es-operator-strip__state-dot {
      background: #79ff70;
      box-shadow: 0 0 10px rgba(121, 255, 112, 0.22);
    }

    .es-operator-strip__controls {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .es-operator-strip__toggle {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid rgba(51, 255, 51, 0.12);
      background: rgba(6, 14, 6, 0.3);
      color: rgba(117, 247, 107, 0.5);
      cursor: pointer;
      transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s, opacity 0.18s;
      box-shadow: none;
    }

    .es-operator-strip__toggle:hover:not(:disabled) {
      background: rgba(51, 255, 51, 0.08);
      border-color: rgba(51, 255, 51, 0.24);
      color: var(--es-text);
    }

    .es-operator-strip__toggle[data-active="true"] {
      background: rgba(51, 255, 51, 0.14);
      border-color: rgba(51, 255, 51, 0.38);
      color: var(--es-text-strong);
      box-shadow:
        0 0 0 1px rgba(51, 255, 51, 0.08) inset,
        0 0 18px rgba(51, 255, 51, 0.12);
    }

    .es-operator-strip__toggle:disabled {
      opacity: 0.36;
      cursor: not-allowed;
    }

    .es-operator-strip__toggle-icon {
      font-size: 18px;
      line-height: 1;
    }

    .es-command-copy,
    .es-command-stats,
    .es-command-actions,
    .es-monitor-grid,
    .es-monitor-section,
    .es-signal-stack,
    .es-ai-grid,
    .es-summary-grid,
    .es-telemetry-grid,
    .es-dev-panel,
    .es-dev-panel-head {
      display: grid;
      gap: 12px;
    }

    .es-command-action-row,
    .es-operator-tags,
    .es-badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .es-command-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--es-text-strong);
      text-shadow: 0 0 8px rgba(140, 255, 170, 0.12);
    }

    .es-command-subtitle,
    .es-monitor-subtitle,
    .es-label-copy {
      font-size: 12px;
      line-height: 1.6;
      color: var(--es-text-dim);
    }

    .es-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .es-summary-cell,
    .es-monitor-chip {
      position: relative;
      display: grid;
      gap: 4px;
      padding: 8px 10px;
      border: 1px solid rgba(120, 255, 150, 0.05);
      border-radius: 0;
      background: rgba(80, 255, 120, 0.014);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
      min-width: 0;
      overflow: hidden;
      animation: es-border-hum-subtle 5.8s ease-in-out infinite;
    }

    .es-summary-cell::before,
    .es-monitor-chip::before,
    .es-monitor-section::before,
    .es-meter-row::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        repeating-linear-gradient(
          to bottom,
          rgba(190, 255, 200, 0.028) 0px,
          rgba(190, 255, 200, 0.028) 1px,
          rgba(0, 0, 0, 0) 2px,
          rgba(0, 0, 0, 0) 4px
        ),
        linear-gradient(180deg, rgba(180, 255, 190, 0.02), transparent 34%);
      mix-blend-mode: screen;
      opacity: 0.08;
    }

    .es-summary-cell > *,
    .es-monitor-chip > *,
    .es-monitor-section > *,
    .es-meter-row > * {
      position: relative;
      z-index: 1;
    }

    .es-summary-cell-label,
    .es-monitor-chip-label,
    .es-section-label {
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--es-text-dim);
    }

    .es-summary-cell-value,
    .es-monitor-chip-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--es-text-strong);
      line-height: 1.4;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .es-operator-crt {
      position: relative;
      min-width: 0;
      overflow: hidden;
    }

    .crt-panel {
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(circle at center, rgba(120, 255, 150, 0.02), transparent 58%),
        linear-gradient(180deg, var(--crt-bg-2) 0%, var(--crt-bg) 100%);
      color: var(--crt-text);
      border: 1px solid rgba(120, 255, 150, 0.08);
      box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.18), var(--crt-glow-soft);
      border-radius: 0;
      isolation: isolate;
      animation: es-border-hum 6.8s ease-in-out infinite;
    }

    .crt-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      background:
        repeating-linear-gradient(
          to bottom,
          rgba(190, 255, 200, 0.04) 0px,
          rgba(190, 255, 200, 0.04) 1px,
          rgba(0, 0, 0, 0) 2px,
          rgba(0, 0, 0, 0) 4px
        );
      opacity: 0.18;
      mix-blend-mode: screen;
    }

    .crt-panel::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      background:
        radial-gradient(circle at center, transparent 48%, rgba(0, 0, 0, 0.34) 100%),
        linear-gradient(
          125deg,
          rgba(255, 255, 255, 0.025) 0%,
          rgba(255, 255, 255, 0.005) 18%,
          rgba(0, 0, 0, 0.02) 36%,
          rgba(255, 255, 255, 0.015) 54%,
          rgba(0, 0, 0, 0.025) 72%,
          rgba(255, 255, 255, 0.01) 100%
        ),
        radial-gradient(circle at 18% 22%, rgba(191, 255, 174, 0.18) 0 0.6px, transparent 0.8px),
        radial-gradient(circle at 74% 31%, rgba(191, 255, 174, 0.12) 0 0.55px, transparent 0.8px),
        radial-gradient(circle at 63% 72%, rgba(191, 255, 174, 0.1) 0 0.5px, transparent 0.8px),
        radial-gradient(circle at 29% 78%, rgba(191, 255, 174, 0.08) 0 0.5px, transparent 0.8px);
      opacity: 0.26;
      background-repeat: no-repeat, no-repeat, repeat, repeat, repeat, repeat;
    }

    .crt-panel__content {
      position: relative;
      z-index: 3;
      padding: 12px;
    }

    .es-monitor-shell {
      display: grid;
      gap: 14px;
    }

    .crt-title {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--crt-text-strong);
      text-shadow: 0 0 8px rgba(120, 255, 150, 0.12);
    }

    .crt-subtitle {
      margin: 0 0 10px;
      font-size: 10px;
      line-height: 1.5;
      color: var(--crt-text-dim);
    }

    .crt-divider {
      height: 1px;
      margin: 10px 0;
      background: linear-gradient(
        to right,
        rgba(120, 255, 150, 0.02),
        rgba(120, 255, 150, 0.18),
        rgba(120, 255, 150, 0.02)
      );
    }

    .crt-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 11px;
      color: var(--crt-text);
    }

    .crt-status__dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--crt-accent);
      box-shadow: 0 0 10px rgba(140, 255, 160, 0.4);
      flex-shrink: 0;
    }

    .crt-monitor {
      position: relative;
      min-height: 160px;
      border: 1px solid rgba(120, 255, 150, 0.06);
      background:
        linear-gradient(180deg, rgba(120, 255, 150, 0.025), rgba(0, 0, 0, 0.02)),
        rgba(0, 0, 0, 0.16);
      overflow: hidden;
      animation: es-border-hum-subtle 6.2s ease-in-out infinite;
    }

    .crt-monitor::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      background:
        repeating-linear-gradient(
          to bottom,
          rgba(190, 255, 200, 0.04) 0px,
          rgba(190, 255, 200, 0.04) 1px,
          rgba(0, 0, 0, 0) 2px,
          rgba(0, 0, 0, 0) 4px
      ),
        radial-gradient(circle at center, transparent 54%, rgba(0, 0, 0, 0.24) 100%);
      opacity: 0.14;
    }

    .crt-monitor::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      background:
        radial-gradient(circle at center, transparent 46%, rgba(0, 0, 0, 0.26) 100%),
        linear-gradient(
          90deg,
          rgba(120, 255, 150, 0.018) 0%,
          transparent 22%,
          transparent 78%,
          rgba(120, 255, 150, 0.018) 100%
        );
      opacity: 0.22;
    }

    .crt-monitor__graph {
      position: absolute;
      inset: 0;
      z-index: 0;
      background:
        linear-gradient(rgba(120, 255, 150, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(120, 255, 150, 0.05) 1px, transparent 1px);
      background-size: 100% 24px, 24px 100%;
      opacity: 0.35;
      pointer-events: none;
    }

    .crt-monitor__sweep {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(140, 255, 160, 0.04) 45%,
        rgba(140, 255, 160, 0.08) 50%,
        rgba(140, 255, 160, 0.04) 55%,
        transparent 100%
      );
      animation: crt-sweep 4.8s linear infinite;
      pointer-events: none;
    }

    .crt-monitor__content {
      position: relative;
      z-index: 3;
      padding: 12px;
    }

    .es-monitor-grid {
      position: relative;
      z-index: 1;
      grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
      gap: 12px;
      align-items: start;
    }

    .es-monitor-stack {
      display: grid;
      gap: 14px;
    }

    .es-monitor-section {
      position: relative;
      padding: 10px;
      border: 1px solid rgba(120, 255, 150, 0.05);
      border-radius: 0;
      background: rgba(80, 255, 120, 0.012);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
      min-width: 0;
      overflow: hidden;
      animation: es-border-hum-subtle 6s ease-in-out infinite;
    }

    .es-monitor-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      flex-wrap: wrap;
    }

    .es-monitor-title {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--es-text-strong);
    }

    .es-monitor-meta {
      font-size: 11px;
      color: var(--es-text-dim);
      white-space: nowrap;
    }

    .es-monitor-meta:empty {
      display: none;
    }

    .es-signal-stack {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .es-meter-row {
      position: relative;
      display: grid;
      gap: 6px;
      padding: 8px 10px;
      border: 1px solid rgba(120, 255, 150, 0.04);
      background: rgba(80, 255, 120, 0.012);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
      min-width: 0;
      overflow: hidden;
      animation: es-border-hum-subtle 5.6s ease-in-out infinite;
    }

    .es-meter-copy {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 11px;
      line-height: 1.4;
    }

    .es-meter-label {
      color: var(--es-text-dim);
      font-size: 11px;
      letter-spacing: 0.04em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .es-meter-value {
      color: var(--crt-accent);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 0 10px rgba(140, 255, 160, 0.14);
      flex-shrink: 0;
    }

    .es-meter-track {
      position: relative;
      height: 6px;
      border: 1px solid rgba(120, 255, 150, 0.1);
      background: rgba(4, 12, 6, 0.84);
      overflow: hidden;
    }

    .es-meter-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, rgba(120, 255, 150, 0.26) 0%, rgba(220, 255, 220, 0.88) 100%);
      box-shadow: 0 0 12px rgba(140, 255, 170, 0.18);
    }

    .es-ai-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .es-spectrum-wrap {
      display: grid;
      gap: 10px;
    }

    .es-spectrum-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 14px;
    }

    .es-spectrum-bars {
      display: flex;
      align-items: end;
      gap: 4px;
      height: 124px;
      padding: 4px 0 0;
      border: none;
      background: transparent;
    }

    .es-spectrum-bar {
      flex: 1;
      min-width: 0;
      height: 4px;
      background: linear-gradient(180deg, rgba(220, 255, 220, 0.98) 0%, rgba(125, 191, 94, 0.84) 100%);
      box-shadow: 0 0 8px rgba(157, 223, 116, 0.16);
      transition: height 0.08s ease, opacity 0.08s ease;
    }

    .es-spectrogram {
      display: block;
      width: 100%;
      height: 116px;
      border: 1px solid rgba(120, 255, 150, 0.1);
      background: rgba(5, 12, 6, 0.94);
      box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.28);
      animation: es-border-hum-subtle 6.4s ease-in-out infinite;
    }

    .es-operator-layout {
      display: grid;
      gap: 16px;
    }

    .es-workspace-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.85fr);
      gap: 16px;
      align-items: start;
    }

    .es-control-grid {
      display: grid;
      grid-template-columns:
        minmax(280px, 0.9fr)
        minmax(280px, 0.9fr)
        minmax(340px, 1.2fr);
      gap: 14px;
      align-items: start;
    }

    .es-secondary-grid {
      display: grid;
      grid-template-columns: minmax(280px, 0.7fr) minmax(0, 1.3fr);
      gap: 16px;
      align-items: start;
    }

    .es-dev-panel {
      padding: 16px;
    }

    .es-dev-panel[data-active="false"] {
      display: none;
    }

    .es-dev-panel-body {
      display: grid;
      gap: 16px;
    }

    .es-shader-panel,
    .es-card--shader-panel {
      min-width: 0;
    }

    .es-card--shader-panel {
      gap: 10px;
      padding: 12px 0 12px 10px;
      pointer-events: auto;
      overflow-x: hidden;
      overflow-y: hidden;
      align-self: start;
    }

    .es-card--shader-panel > [data-role="drag-handle"] {
      margin-right: 10px;
    }

    .es-shader-panel__controls,
    .es-shader-panel__detail,
    .es-shader-form-group,
    .es-uniform-content,
    .es-uniform-list,
    .es-uniform-vector {
      display: grid;
      gap: 8px;
    }

    .es-shader-panel__controls {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      padding-right: 8px;
    }

    .es-shader-panel__list,
    .es-uniform-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 640px;
      overflow-y: auto;
      min-height: 0;
      padding-right: 4px;
    }

    .es-shader-panel__list--surfaces {
      max-height: 520px;
    }

    .es-shader-panel__detail {
      gap: 10px;
      padding: 8px 8px 0 0;
      border-top: 1px solid rgba(51, 255, 51, 0.08);
    }

    .es-shader-action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .es-shader-form-group__label {
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--es-text-dim);
    }

    .es-shader-row {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      width: 100%;
      padding: 10px 12px;
      border-radius: 0;
      border: 1px solid rgba(51, 255, 51, 0.08);
      background: rgba(4, 10, 4, 0.28);
      color: var(--es-text);
      text-align: left;
      cursor: pointer;
      box-shadow: none;
      transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
    }

    .es-shader-row:first-child {
      margin-top: 0;
    }

    .es-shader-row[data-selected="true"] {
      border-color: rgba(51, 255, 51, 0.18);
      background: rgba(12, 28, 12, 0.38);
      color: var(--es-text-strong);
      box-shadow: 0 0 14px rgba(51, 255, 51, 0.05);
    }

    .es-shader-row__copy {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .es-shader-row__title {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: currentColor;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .es-shader-row__meta {
      font-size: 10px;
      color: var(--es-muted);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .es-shader-row__aside,
    .es-shader-row__header {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .es-shader-row__header {
      justify-content: space-between;
      width: 100%;
    }

    .es-shader-row__button {
      display: grid;
      gap: 4px;
      width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .es-shader-empty {
      padding: 14px 10px;
      border: 1px dashed rgba(51, 255, 51, 0.18);
      background: rgba(4, 10, 4, 0.48);
      color: var(--es-muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: center;
    }

    .es-shader-row__dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: rgba(51, 255, 51, 0.18);
      box-shadow: none;
      flex-shrink: 0;
    }

    .es-shader-row__dot[data-state="live"],
    .es-shader-row__dot[data-state="linked"] {
      background: rgb(51 255 51);
      box-shadow: 0 0 10px rgba(51, 255, 51, 0.24);
    }

    .es-shader-row__dot[data-state="idle"] {
      background: rgba(62, 167, 59, 0.42);
    }

    .es-shader-toggle {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--es-text);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .es-uniform-card {
      display: grid;
      gap: 8px;
      padding: 8px 0 9px;
      border-top: 1px solid rgba(51, 255, 51, 0.08);
    }

    .es-uniform-card:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .es-uniform-card[data-editable="false"] {
      opacity: 0.8;
    }

    .es-uniform-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .es-uniform-label__title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--es-text);
    }

    .es-uniform-value {
      padding: 6px 0;
      border: 0;
      background: transparent;
      color: var(--es-text);
      font-size: 11px;
    }

    .es-uniform-range {
      margin: 0;
    }

    .es-uniform-vector-grid {
      display: grid;
      gap: 8px;
    }

    .es-uniform-color {
      width: 100%;
      height: 30px;
      padding: 3px;
      background: rgba(6, 14, 8, 0.54);
      border: 1px solid rgba(51, 255, 51, 0.12);
      border-radius: 0;
    }

    .es-shader-panel__detail[data-visible="false"] {
      display: none;
    }

    .es-toggle-note {
      font-size: 11px;
      color: var(--es-text-dim);
      white-space: nowrap;
    }

    @keyframes crt-sweep {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    @keyframes es-border-hum {
      0%, 100% {
        border-color: rgba(120, 255, 150, 0.12);
        box-shadow:
          inset 0 0 0 1px rgba(140, 255, 170, 0.05),
          inset 0 0 30px rgba(0, 0, 0, 0.28),
          0 0 10px rgba(140, 255, 160, 0.06);
      }

      50% {
        border-color: rgba(160, 255, 180, 0.2);
        box-shadow:
          inset 0 0 0 1px rgba(180, 255, 190, 0.08),
          inset 0 0 34px rgba(0, 0, 0, 0.3),
          0 0 16px rgba(140, 255, 160, 0.12);
      }
    }

    @keyframes es-border-hum-subtle {
      0%, 100% {
        border-color: rgba(120, 255, 150, 0.08);
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.22),
          0 0 8px rgba(140, 255, 160, 0.04);
      }

      50% {
        border-color: rgba(160, 255, 180, 0.14);
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.22),
          0 0 12px rgba(140, 255, 160, 0.08);
      }
    }

    @media (max-width: 1280px) {
      .es-monitor-grid,
      .es-spectrum-grid,
      .es-workspace-grid,
      .es-secondary-grid,
      .es-operator-strip {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    @media (max-width: 1520px) {
      .es-control-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 1080px) {
      .es-control-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    @media (max-width: 860px) {
      .es-summary-grid,
      .es-ai-grid,
      .es-signal-stack {
        grid-template-columns: minmax(0, 1fr);
      }

      .es-operator-modebar {
        grid-template-columns: minmax(0, 1fr);
      }

      .es-operator-strip__left,
      .es-operator-strip__right {
        flex-wrap: wrap;
        justify-content: flex-start;
      }
    }
  `;
  document.head.append(style);
}
