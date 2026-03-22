export class OutputStageUI {
  constructor(uiEl) {
    this._uiEl = uiEl;
    this._promptVisible = false;
    this.onEnterFullscreen = null;
    this.onPromptVisibilityChange = null;

    this._promptEl = document.createElement('div');
    Object.assign(this._promptEl.style, {
      position: 'absolute',
      inset: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      background: 'rgba(3, 7, 3, 0.72)',
      backdropFilter: 'blur(10px)',
      pointerEvents: 'auto',
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: 'min(420px, 100%)',
      display: 'grid',
      gap: '14px',
      padding: '24px',
      borderRadius: '4px',
      background: 'linear-gradient(180deg, rgba(8, 18, 8, 0.98) 0%, rgba(5, 12, 5, 0.98) 100%)',
      border: '1px solid rgba(120, 170, 96, 0.24)',
      boxShadow: 'inset 0 0 0 1px rgba(189,255,172,0.03), 0 0 24px rgba(64, 120, 54, 0.12)',
      color: '#d5f7c4',
      textAlign: 'center',
      textShadow: '0 0 8px rgba(154, 255, 138, 0.12)',
    });

    const eyebrow = document.createElement('div');
    eyebrow.textContent = 'Output Window';
    Object.assign(eyebrow.style, {
      fontSize: '11px',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: '#7fa96f',
    });

    const title = document.createElement('div');
    title.textContent = 'Click to enter fullscreen';
    Object.assign(title.style, {
      fontSize: '24px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#efffdc',
    });

    this._messageEl = document.createElement('p');
    this._messageEl.textContent = 'The main window requested fullscreen, but the browser needs a click in the output window to continue.';
    Object.assign(this._messageEl.style, {
      fontSize: '14px',
      lineHeight: '1.6',
      color: '#9dc18b',
    });

    this._buttonEl = document.createElement('button');
    this._buttonEl.type = 'button';
    this._buttonEl.textContent = 'Enter Fullscreen';
    Object.assign(this._buttonEl.style, {
      justifySelf: 'center',
      minWidth: '200px',
      padding: '12px 18px',
      borderRadius: '2px',
      border: '1px solid rgba(120, 170, 96, 0.28)',
      background: 'linear-gradient(180deg, rgba(15, 30, 14, 0.96) 0%, rgba(7, 18, 7, 0.98) 100%)',
      color: '#d5f7c4',
      fontSize: '13px',
      fontWeight: '600',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      boxShadow: 'inset 0 0 0 1px rgba(189,255,172,0.03), 0 0 12px rgba(116,255,108,0.05)',
    });
    this._buttonEl.addEventListener('click', () => {
      if (this.onEnterFullscreen) {
        this.onEnterFullscreen();
      }
    });

    const hint = document.createElement('div');
    hint.textContent = 'Browser security may block fullscreen unless this window receives the click directly.';
    Object.assign(hint.style, {
      fontSize: '12px',
      color: '#8fb181',
      lineHeight: '1.5',
    });

    card.append(eyebrow, title, this._messageEl, this._buttonEl, hint);
    this._promptEl.append(card);
    this._uiEl.append(this._promptEl);
  }

  isFullscreenPromptVisible() {
    return this._promptVisible;
  }

  showFullscreenPrompt(message) {
    if (message) {
      this._messageEl.textContent = message;
    }

    if (this._promptVisible) {
      return;
    }

    this._promptVisible = true;
    this._promptEl.style.display = 'flex';
    if (this.onPromptVisibilityChange) {
      this.onPromptVisibilityChange(true);
    }
  }

  hideFullscreenPrompt() {
    if (!this._promptVisible) {
      return;
    }

    this._promptVisible = false;
    this._promptEl.style.display = 'none';
    if (this.onPromptVisibilityChange) {
      this.onPromptVisibilityChange(false);
    }
  }

  dispose() {
    this._promptEl.remove();
  }
}
