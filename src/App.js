import { RendererManager } from './core/RendererManager.js';
import { InputController } from './core/InputController.js';
import { SurfaceManager } from './surfaces/SurfaceManager.js';
import { UIManager } from './ui/UIManager.js';
import {
  EDIT_TARGET_CONTENT,
  EDIT_TARGET_SUBTRACT,
  EDIT_TARGET_SURFACE,
} from './surfaces/SurfaceConstants.js';
import {
  createShaderMasterSnapshot,
  createShaderMasterStore,
} from './systems/shader-master/store/shaderMasterStore.ts';
import { ShaderMasterRuntime } from './systems/shader-master/runtime/ShaderMasterRuntime.ts';

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
    this.shaderMasterStore = createShaderMasterStore();
    this.shaderRuntime = new ShaderMasterRuntime({
      renderer: this.renderer.renderer,
      store: this.shaderMasterStore,
    });
    this._shaderUiRevision = this.shaderMasterStore.getState().uiRevision;
    this._unsubscribeShaderMaster = this.shaderMasterStore.subscribe((state) => {
      if (state.uiRevision === this._shaderUiRevision) {
        return;
      }

      this._shaderUiRevision = state.uiRevision;
      this._applyShaderMasterStateToSurfaces();
      if (this._bridge) {
        this._broadcastState();
      }
    });

    this._wireInput();
    this._wireUI();
    this._wireFrameLoop();
    this._syncShaderMasterSurfaces();
    this._applyShaderMasterStateToSurfaces();
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
      this.shaderMasterStore.getState().setSelectedSurface(surfaceId);
      const surface = this.surfaces.activeSurface;
      if (surface && quadType === EDIT_TARGET_SUBTRACT && Number.isInteger(subtractIndex)) {
        surface.selectSubtractQuad(subtractIndex);
      }
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
    };

    this.input.onDeletePressed = () => {
      if (this._mode !== MODE_EDITOR) return;
      this.surfaces.removeActiveSurface();
      this._syncShaderMasterSurfaces();
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
    };

    this.input.onToggleShowMode = () => {
      this.toggleMode();
    };
  }

  _wireUI() {
    this.ui.onAddSurface = () => {
      const surface = this.surfaces.addSurface();
      this._syncShaderMasterSurfaces();
      const selectedOutputId = this.shaderMasterStore.getState().selectedOutputId;
      if (surface && selectedOutputId) {
        this.shaderMasterStore.getState().assignOutputToSurface(surface.id, selectedOutputId);
      }
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
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
    };

    this.ui.onRemoveSubtractQuad = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.removeActiveSubtractQuad()) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
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
      this._syncShaderMasterSurfaces();
      this.ui.updateActiveSurface(surface, this.surfaces.count);
    };

    this.ui.onSendToBack = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!this.surfaces.sendToBack(surface.id)) return;
      this._syncShaderMasterSurfaces();
      this.ui.updateActiveSurface(surface, this.surfaces.count);
    };

    this.ui.onMoveForward = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!this.surfaces.moveForward(surface.id)) return;
      this._syncShaderMasterSurfaces();
      this.ui.updateActiveSurface(surface, this.surfaces.count);
    };

    this.ui.onMoveBackward = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!this.surfaces.moveBackward(surface.id)) return;
      this._syncShaderMasterSurfaces();
      this.ui.updateActiveSurface(surface, this.surfaces.count);
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
      this.shaderRuntime.render(time);
      this._applyShaderMasterStateToSurfaces();
    });
  }

  _wireBridge() {
    this._bridge.on('setMode', ({ mode }) => {
      if (mode === MODE_EDITOR || mode === MODE_SHOW) {
        this.setMode(mode);
      }
    });

    this._bridge.on('addSurface', () => {
      const surface = this.surfaces.addSurface();
      this._syncShaderMasterSurfaces();
      const selectedOutputId = this.shaderMasterStore.getState().selectedOutputId;
      if (surface && selectedOutputId) {
        this.shaderMasterStore.getState().assignOutputToSurface(surface.id, selectedOutputId);
      }
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
    });

    this._bridge.on('setEditTarget', ({ target }) => {
      this.setEditTarget(target);
    });

    this._bridge.on('shaderCommand', ({ type, payload = {} }) => {
      this._handleShaderCommand(type, payload);
    });

    this._bridge.on('ping', () => {
      this._broadcastState();
    });
  }

  _handleShaderCommand(type, payload) {
    const shaderState = this.shaderMasterStore.getState();

    switch (type) {
      case 'selectSurface':
        if (payload.surfaceId) {
          this.surfaces.selectSurface(payload.surfaceId);
          this.shaderMasterStore.getState().setSelectedSurface(payload.surfaceId);
          this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
        }
        return;
      case 'assignOutputToSurface':
        this.shaderMasterStore.getState().assignOutputToSurface(
          payload.surfaceId,
          payload.outputId ?? null,
        );
        return;
      case 'selectOutput':
        shaderState.setSelectedOutput(payload.outputId ?? null);
        return;
      case 'createOutput':
        shaderState.createOutput(payload.presetId, payload.name);
        return;
      case 'duplicateOutput':
        if (payload.outputId) {
          shaderState.duplicateOutput(payload.outputId);
        }
        return;
      case 'deleteOutput':
        if (payload.outputId) {
          shaderState.deleteOutput(payload.outputId);
        }
        return;
      case 'renameOutput':
        if (payload.outputId) {
          shaderState.renameOutput(payload.outputId, payload.name);
        }
        return;
      case 'setOutputEnabled':
        if (payload.outputId) {
          shaderState.setOutputEnabled(payload.outputId, Boolean(payload.enabled));
        }
        return;
      case 'changeOutputPreset':
        if (payload.outputId && payload.presetId) {
          shaderState.changeOutputPreset(payload.outputId, payload.presetId);
        }
        return;
      case 'updateOutputUniform':
        if (payload.outputId && payload.key) {
          shaderState.updateOutputUniform(payload.outputId, payload.key, payload.value);
        }
        return;
      case 'applyVisualIntent':
        if (payload.intent) {
          shaderState.applyVisualIntent(payload.intent);
        }
        return;
      case 'setAudioUniforms':
        shaderState.setAudioUniforms(payload.uniforms || {});
        return;
      case 'setFeelingUniforms':
        shaderState.setFeelingUniforms(payload.uniforms || {});
        return;
      default:
        return;
    }
  }

  _getSurfaceReferences() {
    return this.surfaces.all.map((surface) => ({
      id: surface.id,
      name: surface.name,
      order: surface.order,
      visible: surface.visible,
      assignedOutputId: surface.assignedOutputId,
    }));
  }

  _syncShaderMasterSurfaces() {
    const shaderState = this.shaderMasterStore.getState();
    shaderState.syncSurfaces(this._getSurfaceReferences());
    shaderState.setSelectedSurface(this.surfaces.activeSurface?.id || null);
  }

  _applyShaderMasterStateToSurfaces() {
    const shaderState = this.shaderMasterStore.getState();

    this.surfaces.all.forEach((surface) => {
      const assignedOutputId = shaderState.surfaceAssignments[surface.id] ?? null;
      surface.assignOutput(assignedOutputId);
      surface.setOutputTexture(this.shaderRuntime.getOutputTexture(assignedOutputId));
    });
  }

  _broadcastState() {
    if (!this._bridge) return;
    this._bridge.send('state', {
      mode: this._mode,
      editTarget: this._editTarget,
      surfaceCount: this.surfaces.count,
      surfaces: this._getSurfaceReferences(),
      shaderMaster: createShaderMasterSnapshot(this.shaderMasterStore.getState()),
    });
  }

  dispose() {
    this.input.dispose();
    this.ui.dispose();
    if (this._unsubscribeShaderMaster) this._unsubscribeShaderMaster();
    this.shaderRuntime.dispose();
    this.renderer.dispose();
    if (this._bridge) this._bridge.dispose();
  }
}
