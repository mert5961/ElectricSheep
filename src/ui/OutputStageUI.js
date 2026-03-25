import './retro-ui.css';

export class OutputStageUI {
  constructor(uiEl) {
    this._uiEl = uiEl;
    this._promptVisible = false;
    this.onEnterFullscreen = null;
    this.onPromptVisibilityChange = null;

    this._promptEl = document.createElement('div');
    this._promptEl.className = 'es-output-prompt';

    const card = document.createElement('div');
    card.className = 'es-output-card';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'es-output-eyebrow';
    eyebrow.textContent = 'Output Window';

    const title = document.createElement('div');
    title.className = 'es-output-title';
    title.textContent = 'Click to enter fullscreen';

    this._messageEl = document.createElement('p');
    this._messageEl.className = 'es-output-message';
    this._messageEl.textContent = 'The main window requested fullscreen, but the browser needs a click in the output window to continue.';

    this._buttonEl = document.createElement('button');
    this._buttonEl.type = 'button';
    this._buttonEl.className = 'es-output-btn';
    this._buttonEl.textContent = 'Enter Fullscreen';
    this._buttonEl.addEventListener('click', () => {
      if (this.onEnterFullscreen) {
        this.onEnterFullscreen();
      }
    });

    const hint = document.createElement('div');
    hint.className = 'es-output-hint';
    hint.textContent = 'Browser security may block fullscreen unless this window receives the click directly.';

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
