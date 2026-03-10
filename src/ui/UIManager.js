import {
  EDIT_TARGET_CONTENT,
  EDIT_TARGET_SUBTRACT,
  EDIT_TARGET_SURFACE,
} from '../surfaces/SurfaceConstants.js';

export class UIManager {
  constructor(uiEl) {
    this._uiEl = uiEl;
    this._showMode = false;
    this._editTarget = EDIT_TARGET_SURFACE;
    this._hasActiveSurface = false;
    this._toolbar = null;
    this._featherSlider = null;
    this._featherLabel = null;
    this._surfaceLabel = null;
    this._subtractLabel = null;
    this._editTargetButtons = new Map();
    this._addSubtractBtn = null;
    this._removeSubtractBtn = null;
    this._prevSubtractBtn = null;
    this._nextSubtractBtn = null;

    this.onAddSurface = null;
    this.onFeatherChange = null;
    this.onEditTargetChange = null;
    this.onAddSubtractQuad = null;
    this.onRemoveSubtractQuad = null;
    this.onCycleSubtractQuad = null;
    this.onFullscreen = null;

    this._build();
  }

  get showMode() {
    return this._showMode;
  }

  setEditTarget(target) {
    if (
      target !== EDIT_TARGET_SURFACE &&
      target !== EDIT_TARGET_CONTENT &&
      target !== EDIT_TARGET_SUBTRACT
    ) {
      return;
    }
    this._editTarget = target;
    this._syncEditTargetButtons();
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
    this._hasActiveSurface = Boolean(surface);
    if (surface) {
      this._surfaceLabel.textContent = surface.name;
      this._featherSlider.value = surface.feather;
      this._featherLabel.textContent = surface.feather.toFixed(2);
      this._featherSlider.disabled = false;
      this._subtractLabel.textContent = surface.subtractQuadCount > 0
        ? `Subtract ${surface.activeSubtractQuadIndex + 1}/${surface.subtractQuadCount}`
        : 'No subtract quads';
    } else {
      this._surfaceLabel.textContent = 'No surface selected';
      this._featherSlider.value = 0;
      this._featherLabel.textContent = '0.00';
      this._featherSlider.disabled = true;
      this._subtractLabel.textContent = 'No subtract quads';
    }

    this._syncEditTargetButtons();
    this._syncSubtractButtons(surface);
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

    const editTargetGroup = document.createElement('div');
    Object.assign(editTargetGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const editTargetLabel = document.createElement('span');
    editTargetLabel.textContent = 'Edit';
    editTargetLabel.style.color = '#888';

    const editTargetToggle = document.createElement('div');
    Object.assign(editTargetToggle.style, {
      display: 'flex',
      gap: '4px',
      padding: '4px',
      borderRadius: '8px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)',
    });

    editTargetToggle.append(
      this._createEditTargetButton('Surface', EDIT_TARGET_SURFACE),
      this._createEditTargetButton('Content', EDIT_TARGET_CONTENT),
      this._createEditTargetButton('Subtract', EDIT_TARGET_SUBTRACT),
    );
    editTargetGroup.append(editTargetLabel, editTargetToggle);

    const subtractGroup = document.createElement('div');
    Object.assign(subtractGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    this._subtractLabel = document.createElement('span');
    this._subtractLabel.textContent = 'No subtract quads';
    Object.assign(this._subtractLabel.style, {
      color: '#aaa',
      minWidth: '126px',
      fontVariantNumeric: 'tabular-nums',
    });

    this._addSubtractBtn = this._createButton('+ Subtract', () => {
      if (this.onAddSubtractQuad) this.onAddSubtractQuad();
    });
    this._removeSubtractBtn = this._createButton('- Subtract', () => {
      if (this.onRemoveSubtractQuad) this.onRemoveSubtractQuad();
    });
    this._prevSubtractBtn = this._createButton('Prev', () => {
      if (this.onCycleSubtractQuad) this.onCycleSubtractQuad(-1);
    });
    this._nextSubtractBtn = this._createButton('Next', () => {
      if (this.onCycleSubtractQuad) this.onCycleSubtractQuad(1);
    });

    subtractGroup.append(
      this._subtractLabel,
      this._addSubtractBtn,
      this._removeSubtractBtn,
      this._prevSubtractBtn,
      this._nextSubtractBtn,
    );

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

    this._toolbar.append(
      addBtn,
      this._surfaceLabel,
      editTargetGroup,
      subtractGroup,
      featherGroup,
      fsBtn,
      hint,
    );
    this._uiEl.appendChild(this._toolbar);
    this._syncEditTargetButtons();
    this._syncSubtractButtons(null);
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

  _createEditTargetButton(label, target) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      background: 'transparent',
      color: '#888',
      border: '1px solid transparent',
      borderRadius: '6px',
      padding: '4px 10px',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
    });

    btn.addEventListener('click', () => {
      if (!this._hasActiveSurface) return;
      if (this.onEditTargetChange) this.onEditTargetChange(target);
    });

    this._editTargetButtons.set(target, btn);
    return btn;
  }

  _syncEditTargetButtons() {
    this._editTargetButtons.forEach((button, target) => {
      const isActive = target === this._editTarget;
      const isDisabled = !this._hasActiveSurface;
      const accent = target === EDIT_TARGET_SURFACE
        ? '#66d4ff'
        : target === EDIT_TARGET_CONTENT
          ? '#ffb454'
          : '#ff6f61';

      button.disabled = isDisabled;
      button.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
      button.style.opacity = isDisabled ? '0.45' : '1';
      button.style.background = isActive ? `${accent}22` : 'transparent';
      button.style.borderColor = isActive ? `${accent}88` : 'transparent';
      button.style.color = isActive ? accent : '#888';
    });
  }

  _syncSubtractButtons(surface) {
    const hasSurface = Boolean(surface);
    const subtractCount = surface ? surface.subtractQuadCount : 0;
    const canAddSubtract = hasSurface && subtractCount < (surface?.subtractQuadLimit ?? 0);
    const canManageSubtract = hasSurface && subtractCount > 0;

    [
      [this._addSubtractBtn, canAddSubtract],
      [this._removeSubtractBtn, canManageSubtract],
      [this._prevSubtractBtn, canManageSubtract],
      [this._nextSubtractBtn, canManageSubtract],
    ].forEach(([button, enabled]) => {
      if (!button) return;
      button.disabled = !enabled;
      button.style.cursor = enabled ? 'pointer' : 'not-allowed';
      button.style.opacity = enabled ? '1' : '0.45';
    });
  }

  dispose() {
    if (this._toolbar) {
      this._toolbar.remove();
    }
    document.body.style.cursor = '';
  }
}
