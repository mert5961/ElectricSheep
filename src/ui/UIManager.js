export class UIManager {
  constructor(uiEl) {
    this._uiEl = uiEl;
    this._showMode = false;
    this._toolbar = null;
    this._featherSlider = null;
    this._featherLabel = null;
    this._surfaceLabel = null;

    this.onAddSurface = null;
    this.onFeatherChange = null;
    this.onFullscreen = null;

    this._build();
  }

  get showMode() {
    return this._showMode;
  }

  setShowMode(active) {
    this._showMode = active;
    this._toolbar.style.display = active ? 'none' : 'flex';
    document.body.style.cursor = active ? 'none' : '';
  }

  toggleShowMode() {
    this.setShowMode(!this._showMode);
    return this._showMode;
  }

  updateActiveSurface(surface) {
    if (surface) {
      this._surfaceLabel.textContent = surface.name;
      this._featherSlider.value = surface.feather;
      this._featherLabel.textContent = surface.feather.toFixed(2);
      this._featherSlider.disabled = false;
    } else {
      this._surfaceLabel.textContent = 'No surface selected';
      this._featherSlider.value = 0;
      this._featherLabel.textContent = '0.00';
      this._featherSlider.disabled = true;
    }
  }

  _build() {
    this._toolbar = document.createElement('div');
    Object.assign(this._toolbar.style, {
      position: 'absolute',
      top: '12px',
      left: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 14px',
      background: 'rgba(0,0,0,0.7)',
      borderRadius: '8px',
      backdropFilter: 'blur(8px)',
      fontSize: '13px',
      userSelect: 'none',
    });

    // Add Surface button
    const addBtn = this._createButton('+ Surface', () => {
      if (this.onAddSurface) this.onAddSurface();
    });

    // Surface label
    this._surfaceLabel = document.createElement('span');
    this._surfaceLabel.textContent = 'No surface selected';
    Object.assign(this._surfaceLabel.style, {
      color: '#aaa',
      minWidth: '120px',
    });

    // Feather control
    const featherGroup = document.createElement('div');
    Object.assign(featherGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const featherText = document.createElement('span');
    featherText.textContent = 'Feather';
    featherText.style.color = '#888';

    this._featherSlider = document.createElement('input');
    this._featherSlider.type = 'range';
    this._featherSlider.min = '0';
    this._featherSlider.max = '0.25';
    this._featherSlider.step = '0.005';
    this._featherSlider.value = '0';
    this._featherSlider.disabled = true;
    Object.assign(this._featherSlider.style, {
      width: '100px',
      accentColor: '#6af',
    });

    this._featherLabel = document.createElement('span');
    this._featherLabel.textContent = '0.00';
    Object.assign(this._featherLabel.style, {
      color: '#aaa',
      minWidth: '32px',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    });

    this._featherSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this._featherLabel.textContent = val.toFixed(2);
      if (this.onFeatherChange) this.onFeatherChange(val);
    });

    featherGroup.append(featherText, this._featherSlider, this._featherLabel);

    // Fullscreen button
    const fsBtn = this._createButton('Fullscreen', () => {
      if (this.onFullscreen) this.onFullscreen();
    });

    // Show mode hint
    const hint = document.createElement('span');
    hint.textContent = '[H] show mode';
    Object.assign(hint.style, {
      color: '#555',
      fontSize: '11px',
      marginLeft: '4px',
    });

    this._toolbar.append(addBtn, this._surfaceLabel, featherGroup, fsBtn, hint);
    this._uiEl.appendChild(this._toolbar);
  }

  _createButton(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      background: 'rgba(255,255,255,0.1)',
      color: '#ccc',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '4px',
      padding: '4px 10px',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'background 0.15s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,255,255,0.2)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.1)';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  dispose() {
    if (this._toolbar) {
      this._toolbar.remove();
    }
    document.body.style.cursor = '';
  }
}
