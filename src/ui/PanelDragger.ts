const PANEL_LAYOUT_STORAGE_PREFIX = 'electric-sheep:panel-layout:';
const PANEL_LAYOUT_RESET_EVENT = 'electric-sheep:panel-layout:reset';

type DragMode = 'translate' | 'absolute';

type PanelLayoutState = {
  x: number;
  y: number;
  width?: number;
};

type DraggablePanelOptions = {
  id: string;
  element: HTMLElement;
  handle: HTMLElement | null;
  boundsEl: HTMLElement | null;
  mode?: DragMode;
  desktopMinWidth?: number;
  minVisible?: number;
};

function readState(id: string): PanelLayoutState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${PANEL_LAYOUT_STORAGE_PREFIX}${id}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') {
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
      width: typeof parsed.width === 'number' ? parsed.width : undefined,
    };
  } catch {
    return null;
  }
}

function writeState(id: string, state: PanelLayoutState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${PANEL_LAYOUT_STORAGE_PREFIX}${id}`, JSON.stringify(state));
  } catch {}
}

function removeState(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(`${PANEL_LAYOUT_STORAGE_PREFIX}${id}`);
  } catch {}
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('button, input, select, textarea, a, [role="button"]'));
}

export function resetAllPanelLayouts(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(PANEL_LAYOUT_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {}

  window.dispatchEvent(new CustomEvent(PANEL_LAYOUT_RESET_EVENT));
}

export class DraggablePanelController {
  private readonly id: string;

  private readonly element: HTMLElement;

  private readonly handle: HTMLElement | null;

  private readonly boundsEl: HTMLElement | null;

  private readonly mode: DragMode;

  private readonly desktopMinWidth: number;

  private readonly minVisible: number;

  private readonly defaultInlineStyles: Record<string, string>;

  private hasSavedState: boolean;

  private state: PanelLayoutState;

  private enabled = false;

  constructor({
    id,
    element,
    handle,
    boundsEl,
    mode = 'translate',
    desktopMinWidth = 1180,
    minVisible = 72,
  }: DraggablePanelOptions) {
    this.id = id;
    this.element = element;
    this.handle = handle;
    this.boundsEl = boundsEl;
    this.mode = mode;
    this.desktopMinWidth = desktopMinWidth;
    this.minVisible = minVisible;
    const savedState = readState(id);
    this.hasSavedState = Boolean(savedState);
    this.state = savedState || { x: 0, y: 0 };
    this.defaultInlineStyles = {
      transform: element.style.transform,
      left: element.style.left,
      top: element.style.top,
      right: element.style.right,
      bottom: element.style.bottom,
      width: element.style.width,
      zIndex: element.style.zIndex,
    };

    this.element.classList.add('es-panel-draggable');
    this.handle?.classList.add('es-panel-drag-handle');
    this.handle?.setAttribute('title', 'Drag panel');
    this.handle?.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('resize', this._onViewportChange);
    window.addEventListener(PANEL_LAYOUT_RESET_EVENT, this._onReset);

    this._syncEnabledState();
  }

  reset(): void {
    this.hasSavedState = false;
    this.state = { x: 0, y: 0 };
    removeState(this.id);
    this._restoreDefaults();
    this._syncEnabledState();
  }

  private _onReset = (): void => {
    this.reset();
  };

  private _onViewportChange = (): void => {
    this._syncEnabledState();
  };

  private _syncEnabledState(): void {
    const nextEnabled = typeof window !== 'undefined' && window.innerWidth > this.desktopMinWidth;
    if (nextEnabled === this.enabled) {
      if (nextEnabled) {
        this._applyState();
      }
      return;
    }

    this.enabled = nextEnabled;
    this.element.dataset.draggableEnabled = this.enabled ? 'true' : 'false';

    if (!this.enabled) {
      this._restoreDefaults();
      return;
    }

    this._applyState();
  }

  private _restoreDefaults(): void {
    this.element.style.transform = this.defaultInlineStyles.transform;
    this.element.style.left = this.defaultInlineStyles.left;
    this.element.style.top = this.defaultInlineStyles.top;
    this.element.style.right = this.defaultInlineStyles.right;
    this.element.style.bottom = this.defaultInlineStyles.bottom;
    this.element.style.width = this.defaultInlineStyles.width;
    this.element.style.zIndex = this.defaultInlineStyles.zIndex;
    this.element.dataset.dragging = 'false';
  }

  private _applyState(): void {
    if (!this.enabled) {
      return;
    }

    if (!this.hasSavedState && this.state.x === 0 && this.state.y === 0 && this.state.width === undefined) {
      return;
    }

    if (this.mode === 'translate') {
      this.element.style.transform = `translate(${this.state.x}px, ${this.state.y}px)`;
      return;
    }

    const rect = this.element.getBoundingClientRect();
    this.element.style.left = `${this.state.x}px`;
    this.element.style.top = `${this.state.y}px`;
    this.element.style.right = 'auto';
    this.element.style.bottom = 'auto';
    this.element.style.width = `${this.state.width ?? rect.width}px`;
  }

  private _onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled || !this.handle || !this.boundsEl || event.button !== 0 || isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();

    const boundsRect = this.boundsEl.getBoundingClientRect();
    const startRect = this.element.getBoundingClientRect();
    const startState = { ...this.state };
    const startLeft = startRect.left - boundsRect.left;
    const startTop = startRect.top - boundsRect.top;
    const width = startRect.width;

    if (this.mode === 'absolute') {
      this.element.style.left = `${startLeft}px`;
      this.element.style.top = `${startTop}px`;
      this.element.style.right = 'auto';
      this.element.style.bottom = 'auto';
      this.element.style.width = `${width}px`;
      this.state.width = width;
      this.hasSavedState = true;
    }

    this.element.dataset.dragging = 'true';
    this.element.style.zIndex = '20';
    this.handle.setPointerCapture?.(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const rawLeft = startLeft + (moveEvent.clientX - event.clientX);
      const rawTop = startTop + (moveEvent.clientY - event.clientY);
      const nextLeft = Math.max(-(width - this.minVisible), Math.min(rawLeft, boundsRect.width - this.minVisible));
      const nextTop = Math.max(0, Math.min(rawTop, boundsRect.height - this.minVisible));

      if (this.mode === 'translate') {
      this.state.x = startState.x + (nextLeft - startLeft);
      this.state.y = startState.y + (nextTop - startTop);
      this.hasSavedState = true;
      this.element.style.transform = `translate(${this.state.x}px, ${this.state.y}px)`;
      return;
    }

    this.state.x = nextLeft;
    this.state.y = nextTop;
    this.state.width = width;
    this.hasSavedState = true;
      this.element.style.left = `${nextLeft}px`;
      this.element.style.top = `${nextTop}px`;
    };

    const onPointerUp = (): void => {
      this.element.dataset.dragging = 'false';
      this.element.style.zIndex = this.defaultInlineStyles.zIndex;
      writeState(this.id, this.state);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };
}
