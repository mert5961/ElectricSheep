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
      background: 'rgba(4, 6, 9, 0.52)',
      backdropFilter: 'blur(10px)',
      pointerEvents: 'auto',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: 'min(420px, 100%)',
      display: 'grid',
      gap: '14px',
      padding: '24px',
      borderRadius: '20px',
      background: 'linear-gradient(180deg, rgba(14,18,24,0.94) 0%, rgba(9,12,17,0.9) 100%)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 28px 80px rgba(0, 0, 0, 0.42)',
      color: '#edf1f7',
      textAlign: 'center',
    });

    const eyebrow = document.createElement('div');
    eyebrow.textContent = 'Output Window';
    Object.assign(eyebrow.style, {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#8fa1b9',
    });

    const title = document.createElement('div');
    title.textContent = 'Click to enter fullscreen';
    Object.assign(title.style, {
      fontSize: '24px',
      fontWeight: '700',
      color: '#f6f8fb',
    });

    this._messageEl = document.createElement('p');
    this._messageEl.textContent = 'The main window requested fullscreen, but the browser needs a click in the output window to continue.';
    Object.assign(this._messageEl.style, {
      fontSize: '14px',
      lineHeight: '1.6',
      color: '#b8c2d1',
    });

    this._buttonEl = document.createElement('button');
    this._buttonEl.type = 'button';
    this._buttonEl.textContent = 'Enter Fullscreen';
    Object.assign(this._buttonEl.style, {
      justifySelf: 'center',
      minWidth: '200px',
      padding: '12px 18px',
      borderRadius: '999px',
      border: '1px solid rgba(255, 194, 109, 0.32)',
      background: 'linear-gradient(135deg, rgba(255, 180, 84, 0.32) 0%, rgba(255, 220, 168, 0.14) 100%)',
      color: '#fff4df',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
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
      color: '#8c98aa',
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
