import { RendererManager } from './core/RendererManager.js';
import { InputController } from './core/InputController.js';
import { SurfaceManager } from './surfaces/SurfaceManager.js';
import { UIManager } from './ui/UIManager.js';
import { OutputRouter } from './routing/OutputRouter.js';
import {
  EDIT_TARGET_CONTENT,
  EDIT_TARGET_SUBTRACT,
  EDIT_TARGET_SURFACE,
} from './surfaces/SurfaceConstants.js';

const MODE_EDITOR = 'editor';
const MODE_SHOW = 'show';

export class App {
  constructor({ bridge = null } = {}) {
    const canvas = document.getElementById('webgl-canvas');
    const overlayEl = document.getElementById('overlay');
    const uiEl = document.getElementById('ui');

    this._mode = MODE_EDITOR;
    this._editTarget = EDIT_TARGET_SURFACE;
    this._bridge = bridge;

    this.renderer = new RendererManager(canvas);
    this.surfaces = new SurfaceManager(this.renderer.scene, overlayEl);
    this.input = new InputController(overlayEl, canvas);
    this.ui = new UIManager(uiEl);
    this.router = new OutputRouter();

    this._wireInput();
    this._wireUI();
    this._wireFrameLoop();
    this.surfaces.setEditTarget(this._editTarget);
    this.ui.setEditTarget(this._editTarget);
    this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);

    if (this._bridge) {
      this._wireBridge();
    }
  }

  get mode() {
    return this._mode;
  }

  get editTarget() {
    return this._editTarget;
  }

  setMode(mode) {
    this._mode = mode;

    const isShow = mode === MODE_SHOW;
    this.ui.setShowMode(isShow);
    this.surfaces.setDebugVisible(!isShow);

    if (this._bridge) {
      this._broadcastState();
    }
    console.log(`[ElectricSheep] Mode: ${mode}`);
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
    this.surfaces.setEditTarget(target);
    this.ui.setEditTarget(target);
    this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);

    if (this._bridge) {
      this._broadcastState();
    }
    console.log(`[ElectricSheep] Edit target: ${target}`);
  }

  toggleMode() {
    this.setMode(this._mode === MODE_EDITOR ? MODE_SHOW : MODE_EDITOR);
  }

  start() {
    this.renderer.start();
    this.setEditTarget(this._editTarget);
    this.setMode(MODE_EDITOR);
    console.log('[ElectricSheep] Output started');
  }

  // --- Wiring ---

  _wireInput() {
    this.input.onQuadDrag = (surfaceId, quadType, subtractIndex, cornerIndex, x, y) => {
      const surface = this.surfaces.getSurface(surfaceId);
      if (surface) surface.updateQuadCorner(quadType, cornerIndex, x, y, subtractIndex);
    };

    this.input.onQuadDragEnd = () => {};

    this.input.onSurfaceSelect = (surfaceId, quadType, subtractIndex) => {
      this.surfaces.selectByHandle(surfaceId);
      const surface = this.surfaces.activeSurface;
      if (surface && quadType === EDIT_TARGET_SUBTRACT && Number.isInteger(subtractIndex)) {
        surface.selectSubtractQuad(subtractIndex);
      }
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
    };

    this.input.onDeletePressed = () => {
      if (this._mode !== MODE_EDITOR) return;
      this.surfaces.removeActiveSurface();
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.input.onToggleShowMode = () => {
      this.toggleMode();
    };
  }

  _wireUI() {
    this.ui.onAddSurface = () => {
      this.surfaces.addSurface();
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onFeatherChange = (value) => {
      const surface = this.surfaces.activeSurface;
      if (surface) surface.updateFeather(value);
    };

    this.ui.onSubtractFeatherChange = (value) => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.setSubtractQuadFeather(value)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
    };

    this.ui.onEditTargetChange = (target) => {
      this.setEditTarget(target);
    };

    this.ui.onAddSubtractQuad = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      surface.addSubtractQuad();
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onRemoveSubtractQuad = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.removeActiveSubtractQuad()) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onCycleSubtractQuad = (direction) => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.cycleSubtractQuad(direction)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
    };

    this.ui.onBringToFront = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!this.surfaces.bringToFront(surface.id)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onSendToBack = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!this.surfaces.sendToBack(surface.id)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onMoveForward = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!this.surfaces.moveForward(surface.id)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onMoveBackward = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!this.surfaces.moveBackward(surface.id)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
  }

  _wireFrameLoop() {
    this.renderer.onFrame((time) => {
      this.surfaces.updateTime(time);
    });
  }

  _wireBridge() {
    this._bridge.on('setMode', ({ mode }) => {
      if (mode === MODE_EDITOR || mode === MODE_SHOW) {
        this.setMode(mode);
      }
    });

    this._bridge.on('addSurface', () => {
      this.surfaces.addSurface();
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      this._broadcastState();
    });

    this._bridge.on('setEditTarget', ({ target }) => {
      this.setEditTarget(target);
    });

    this._bridge.on('ping', () => {
      this._broadcastState();
    });
  }

  _broadcastState() {
    if (!this._bridge) return;
    this._bridge.send('state', {
      mode: this._mode,
      editTarget: this._editTarget,
      surfaceCount: this.surfaces.count,
    });
  }

  dispose() {
    this.input.dispose();
    this.ui.dispose();
    this.router.dispose();
    this.renderer.dispose();
    if (this._bridge) this._bridge.dispose();
  }
}
