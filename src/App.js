import { RendererManager } from './core/RendererManager.js';
import { InputController } from './core/InputController.js';
import { SurfaceManager } from './surfaces/SurfaceManager.js';
import { UIManager } from './ui/UIManager.js';
import { OutputRouter } from './routing/OutputRouter.js';

export class App {
  constructor() {
    const canvas = document.getElementById('webgl-canvas');
    const overlayEl = document.getElementById('overlay');
    const uiEl = document.getElementById('ui');

    this.renderer = new RendererManager(canvas);
    this.surfaces = new SurfaceManager(this.renderer.scene, overlayEl);
    this.input = new InputController(overlayEl, canvas);
    this.ui = new UIManager(uiEl);
    this.router = new OutputRouter();

    this._wireInput();
    this._wireUI();
    this._wireFrameLoop();
  }

  start() {
    this.renderer.start();
    console.log('[ElectricSheep] App started');
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
      this.surfaces.removeActiveSurface();
      this.ui.updateActiveSurface(this.surfaces.activeSurface);
    };

    this.input.onToggleShowMode = () => {
      const active = this.ui.toggleShowMode();
      this.surfaces.setHandlesVisible(!active);
    };
  }

  _wireUI() {
    this.ui.onAddSurface = () => {
      this.surfaces.addSurface();
      this.ui.updateActiveSurface(this.surfaces.activeSurface);
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

  dispose() {
    this.input.dispose();
    this.ui.dispose();
    this.router.dispose();
    this.renderer.dispose();
  }
}
