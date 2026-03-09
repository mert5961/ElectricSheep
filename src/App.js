import { RendererManager } from './core/RendererManager.js';
import { InputController } from './core/InputController.js';
import { SurfaceManager } from './surfaces/SurfaceManager.js';
import { UIManager } from './ui/UIManager.js';
import { OutputRouter } from './routing/OutputRouter.js';

const MODE_EDITOR = 'editor';
const MODE_SHOW = 'show';

export class App {
  constructor({ bridge = null } = {}) {
    const canvas = document.getElementById('webgl-canvas');
    const overlayEl = document.getElementById('overlay');
    const uiEl = document.getElementById('ui');

    this._mode = MODE_EDITOR;
    this._bridge = bridge;

    this.renderer = new RendererManager(canvas);
    this.surfaces = new SurfaceManager(this.renderer.scene, overlayEl);
    this.input = new InputController(overlayEl, canvas);
    this.ui = new UIManager(uiEl);
    this.router = new OutputRouter();

    this._wireInput();
    this._wireUI();
    this._wireFrameLoop();

    if (this._bridge) {
      this._wireBridge();
    }
  }

  get mode() {
    return this._mode;
  }

  setMode(mode) {
    this._mode = mode;

    const isShow = mode === MODE_SHOW;
    this.ui.setShowMode(isShow);
    this.surfaces.setHandlesVisible(!isShow);

    if (this._bridge) {
      this._broadcastState();
    }
    console.log(`[ElectricSheep] Mode: ${mode}`);
  }

  toggleMode() {
    this.setMode(this._mode === MODE_EDITOR ? MODE_SHOW : MODE_EDITOR);
  }

  start() {
    this.renderer.start();
    this.setMode(MODE_EDITOR);
    console.log('[ElectricSheep] Output started');
  }

  // --- Wiring ---

  _wireInput() {
    this.input.onCornerDrag = (surfaceId, cornerIndex, x, y) => {
      const surface = this.surfaces.getSurface(surfaceId);
      if (surface) surface.updateGeometry(cornerIndex, x, y);
    };

    this.input.onCornerDragEnd = () => {};

    this.input.onSurfaceSelect = (surfaceId) => {
      this.surfaces.selectByHandle(surfaceId);
      this.ui.updateActiveSurface(this.surfaces.activeSurface);
    };

    this.input.onDeletePressed = () => {
      if (this._mode !== MODE_EDITOR) return;
      this.surfaces.removeActiveSurface();
      this.ui.updateActiveSurface(this.surfaces.activeSurface);
      if (this._bridge) this._broadcastState();
    };

    this.input.onToggleShowMode = () => {
      this.toggleMode();
    };
  }

  _wireUI() {
    this.ui.onAddSurface = () => {
      this.surfaces.addSurface();
      this.ui.updateActiveSurface(this.surfaces.activeSurface);
      if (this._bridge) this._broadcastState();
    };

    this.ui.onFeatherChange = (value) => {
      const surface = this.surfaces.activeSurface;
      if (surface) surface.updateFeather(value);
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
      this.ui.updateActiveSurface(this.surfaces.activeSurface);
      this._broadcastState();
    });

    this._bridge.on('ping', () => {
      this._broadcastState();
    });
  }

  _broadcastState() {
    if (!this._bridge) return;
    this._bridge.send('state', {
      mode: this._mode,
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
