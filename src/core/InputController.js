export class InputController {
  constructor(overlayEl, canvasEl) {
    this._overlayEl = overlayEl;
    this._canvasEl = canvasEl;

    this._isDragging = false;
    this._dragSurfaceId = null;
    this._dragQuadType = null;
    this._dragSubtractIndex = null;
    this._dragCornerIndex = -1;
    this._dragHandleEl = null;

    this.onQuadDrag = null;
    this.onQuadDragEnd = null;
    this.onSurfaceSelect = null;
    this.onDeletePressed = null;
    this.onToggleShowMode = null;

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);

    this._overlayEl.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('keydown', this._onKeyDown);
  }

  _handlePointerDown(e) {
    const handle = e.target.closest('.handle');
    if (!handle) return;

    e.preventDefault();
    handle.setPointerCapture(e.pointerId);

    this._isDragging = true;
    this._dragSurfaceId = handle.dataset.surfaceId;
    this._dragQuadType = handle.dataset.quadType;
    this._dragSubtractIndex = handle.dataset.subtractIndex === undefined
      ? null
      : parseInt(handle.dataset.subtractIndex, 10);
    this._dragCornerIndex = parseInt(handle.dataset.cornerIndex, 10);
    this._dragHandleEl = handle;
    handle.style.cursor = 'grabbing';

    if (this.onSurfaceSelect) {
      this.onSurfaceSelect(this._dragSurfaceId, this._dragQuadType, this._dragSubtractIndex);
    }
  }

  _handlePointerMove(e) {
    if (!this._isDragging) return;
    e.preventDefault();

    if (this.onQuadDrag) {
      this.onQuadDrag(
        this._dragSurfaceId,
        this._dragQuadType,
        this._dragSubtractIndex,
        this._dragCornerIndex,
        e.clientX,
        e.clientY,
      );
    }
  }

  _handlePointerUp(e) {
    if (!this._isDragging) return;

    if (this._dragHandleEl) {
      this._dragHandleEl.style.cursor = 'grab';
      this._dragHandleEl.releasePointerCapture?.(e.pointerId);
    }

    if (this.onQuadDragEnd) {
      this.onQuadDragEnd(
        this._dragSurfaceId,
        this._dragQuadType,
        this._dragSubtractIndex,
        this._dragCornerIndex,
      );
    }

    this._isDragging = false;
    this._dragSurfaceId = null;
    this._dragQuadType = null;
    this._dragSubtractIndex = null;
    this._dragCornerIndex = -1;
    this._dragHandleEl = null;
  }

  _handleKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      if (this.onDeletePressed) this.onDeletePressed();
    }

    if (e.key === 'h' || e.key === 'H') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (this.onToggleShowMode) this.onToggleShowMode();
    }
  }

  dispose() {
    this._overlayEl.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
  }
}
