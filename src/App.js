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
  APP_ROLE_EDITOR,
  APP_ROLE_OUTPUT,
  EDITOR_MODULE_GEO,
  EDITOR_MODULE_SHADER,
  OUTPUT_DISPLAY_MODE_SHOW,
  PREVIEW_MODE_EDIT,
  PREVIEW_MODE_OUTPUT,
} from './core/AppModes.js';
import {
  createShaderMasterSnapshot,
  createShaderMasterStore,
} from './systems/shader-master/store/shaderMasterStore.ts';
import { buildAudioDefaults } from './systems/shader-master/contracts/uniforms.ts';
import { AIFeatureTracker } from './systems/shader-master/runtime/aiFeatureTracker.ts';
import {
  getAIState,
  getLastAIRequestMeta,
} from './systems/shader-master/runtime/getAIState.ts';
import { ShaderMasterRuntime } from './systems/shader-master/runtime/ShaderMasterRuntime.ts';
import { AudioAnalyzer } from './systems/audio-analyzer/audioAnalyzer.ts';
import { createAudioAnalyzerStore } from './systems/audio-analyzer/audioAnalyzerStore.ts';
import { MappingAssistOverlay } from './overlays/MappingAssistOverlay.js';
import { OutputStageUI } from './ui/OutputStageUI.js';
import { mountWindowCrtEffects } from './ui/windowCrtEffects.js';

const AI_BOOT_WARMUP_MS = 3000;
const AI_REQUEST_COOLDOWN_MS = 3000;
const AI_MIN_SECTION_UPDATE_INTERVAL_MS = 4000;
const AI_MIN_PHRASE_UPDATE_INTERVAL_MS = 7000;
const AI_MAX_UPDATE_INTERVAL_MS = 14000;
const AI_STALE_THRESHOLD_MS = 22000;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function blendScalar(currentValue, nextValue, amount) {
  return clamp01(currentValue + ((nextValue - currentValue) * amount));
}

function getAIBlendAmount(updateReason) {
  if (updateReason === 'section-change') {
    return 0.74;
  }

  if (updateReason === 'phrase-change') {
    return 0.56;
  }

  if (updateReason === 'boot') {
    return 0.68;
  }

  if (updateReason === 'phrase-refresh') {
    return 0.36;
  }

  return 0.24;
}

function blendAIState(currentAIState, nextAIState, amount) {
  return {
    tension: blendScalar(currentAIState.tension, nextAIState.tension, amount),
    glow: blendScalar(currentAIState.glow, nextAIState.glow, amount),
    fragmentation: blendScalar(currentAIState.fragmentation, nextAIState.fragmentation, amount),
    stillness: blendScalar(currentAIState.stillness, nextAIState.stillness, amount),
    flowBias: blendScalar(currentAIState.flowBias, nextAIState.flowBias, amount),
    warmth: blendScalar(currentAIState.warmth, nextAIState.warmth, amount),
  };
}

function audioSignalsToUniformPatch(signals) {
  return {
    u_audioBass: signals.bass,
    u_audioMid: signals.mid,
    u_audioTreble: signals.treble,
    u_audioEnergy: signals.energy,
    u_audioPulse: signals.pulse,
    u_audioBassSmooth: signals.bassSmooth,
    u_audioHit: signals.hit,
    u_audioFlux: signals.flux,
    u_audioRumble: signals.rumble,
    u_audioKick: signals.kick,
    u_audioSnare: signals.snare,
    u_audioHihat: signals.hihat,
  };
}

function getOutputWindowUrl() {
  return new URL('output.html', window.location.origin + import.meta.env.BASE_URL).toString();
}

export class App {
  constructor({
    bridge = null,
    role = APP_ROLE_EDITOR,
  } = {}) {
    const appEl = document.getElementById('app');
    const canvas = document.getElementById('webgl-canvas');
    const overlayEl = document.getElementById('overlay');
    const uiEl = document.getElementById('ui');

    this._bridge = bridge;
    this._role = role;
    this._activeModule = EDITOR_MODULE_GEO;
    this._editTarget = EDIT_TARGET_SURFACE;
    this._previewMode = role === APP_ROLE_EDITOR ? PREVIEW_MODE_EDIT : PREVIEW_MODE_OUTPUT;
    this._outputDisplayMode = OUTPUT_DISPLAY_MODE_SHOW;
    this._pendingBroadcastFrame = null;
    this._shaderUiRevision = 0;
    this._outputWindowRef = null;
    this._outputWindowConnected = false;
    this._pendingOutputFullscreen = false;
    this._manualAudioUniforms = buildAudioDefaults();
    this._lastAudioSnapshotRefreshMs = 0;
    this._lastAudioBroadcastMs = 0;
    this._lastAIRequestStartedAtMs = null;
    this._lastAICommittedAtFrameMs = null;
    this._lastCommittedAIPhraseState = null;
    this._lastCommittedAISectionState = null;
    this._aiRequestInFlight = false;
    this._windowCrtOverlay = role === APP_ROLE_EDITOR
      ? mountWindowCrtEffects(appEl)
      : null;
    this._aiFeatureTracker = role === APP_ROLE_EDITOR
      ? new AIFeatureTracker()
      : null;

    this.renderer = new RendererManager(canvas);
    this.surfaces = new SurfaceManager(this.renderer.scene, overlayEl);
    this.shaderMasterStore = createShaderMasterStore();
    this.audioAnalyzerStore = role === APP_ROLE_EDITOR
      ? createAudioAnalyzerStore()
      : null;
    this.audioAnalyzer = role === APP_ROLE_EDITOR && this.audioAnalyzerStore
      ? new AudioAnalyzer({
          store: this.audioAnalyzerStore,
        })
      : null;
    this.shaderRuntime = new ShaderMasterRuntime({
      renderer: this.renderer.renderer,
      store: this.shaderMasterStore,
    });
    this.assistOverlay = (role === APP_ROLE_EDITOR || role === APP_ROLE_OUTPUT)
      ? new MappingAssistOverlay(overlayEl)
      : null;
    this.outputUi = role === APP_ROLE_OUTPUT
      ? new OutputStageUI(uiEl)
      : null;
    this.input = role === APP_ROLE_EDITOR
      ? new InputController(overlayEl, canvas)
      : null;
    this.ui = role === APP_ROLE_EDITOR
      ? new UIManager(uiEl)
      : null;

    if (this.outputUi) {
      this.outputUi.onEnterFullscreen = () => {
        this._requestStageFullscreen();
      };
      this.outputUi.onPromptVisibilityChange = () => {
        this._applyPreviewMode();
      };
    }

    this._wireShaderMasterStore();
    this._wireFrameLoop();

    if (this.input) {
      this._wireInput();
    }

    if (this.ui) {
      this._wireUI();
      this.ui.setActiveModule(this._activeModule);
      this.ui.setEditTarget(this._editTarget);
      this.ui.setPreviewMode(this._previewMode);
      this.ui.setOutputDisplayMode(this._outputDisplayMode);
      this.ui.setOutputWindowState({
        available: false,
        connected: false,
      });
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      this._updateShaderMasterUi();
    }

    if (this._bridge) {
      this._wireBridge();
    }

    this._syncShaderMasterSurfaces();
    this._applyShaderMasterStateToSurfaces();
    this._applyPreviewMode();
    this._applyOutputDisplayMode();
  }

  get role() {
    return this._role;
  }

  get editTarget() {
    return this._editTarget;
  }

  get activeModule() {
    return this._activeModule;
  }

  get previewMode() {
    return this._previewMode;
  }

  get outputDisplayMode() {
    return this._outputDisplayMode;
  }

  applyVisualIntent(intent) {
    return this.shaderMasterStore.getState().applyVisualIntent(intent);
  }

  applyVisualStateRecipe(recipe) {
    return this.shaderMasterStore.getState().applyVisualStateRecipe(recipe);
  }

  setActiveModule(module) {
    if (module !== EDITOR_MODULE_GEO && module !== EDITOR_MODULE_SHADER) {
      return;
    }

    if (this._activeModule === module) {
      return;
    }

    this._activeModule = module;
    this._applyPreviewMode();
    if (this.ui) {
      this.ui.setActiveModule(module);
    }
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
    if (this.ui) {
      this.ui.setEditTarget(target);
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
    }

    this._scheduleSceneBroadcast();
  }

  setPreviewMode(mode) {
    if (mode !== PREVIEW_MODE_EDIT && mode !== PREVIEW_MODE_OUTPUT) {
      return;
    }

    this._previewMode = mode;
    this._applyPreviewMode();
    if (this.ui) {
      this.ui.setPreviewMode(mode);
    }
    this._scheduleSceneBroadcast();
  }

  togglePreviewMode() {
    this.setPreviewMode(
      this._previewMode === PREVIEW_MODE_EDIT ? PREVIEW_MODE_OUTPUT : PREVIEW_MODE_EDIT,
    );
  }

  setOutputDisplayMode(mode) {
    this._outputDisplayMode = mode;
    this._applyOutputDisplayMode();
    if (this.ui) {
      this.ui.setOutputDisplayMode(mode);
    }
    this._scheduleSceneBroadcast();
  }

  openOutputWindow() {
    if (this._role !== APP_ROLE_EDITOR) {
      return null;
    }

    const outputWindowUrl = getOutputWindowUrl();
    const existingOutputWindow = this._resolveOutputWindowRef();
    if (existingOutputWindow) {
      this._navigateOutputWindow(existingOutputWindow, outputWindowUrl);
      existingOutputWindow.focus();
      this._broadcastSceneState();
      this._syncOutputWindowState();
      return existingOutputWindow;
    }

    this._outputWindowRef = window.open(
      outputWindowUrl,
      'electric-sheep-output',
      'popup,width=1440,height=900',
    );

    if (this._outputWindowRef) {
      this._outputWindowRef.focus();
    }

    this._syncOutputWindowState();
    return this._outputWindowRef;
  }

  focusOutputWindow() {
    if (this._role !== APP_ROLE_EDITOR) {
      return null;
    }

    const outputWindow = this._resolveOutputWindowRef();
    if (outputWindow) {
      this._navigateOutputWindow(outputWindow, getOutputWindowUrl());
      outputWindow.focus();
      this._syncOutputWindowState();
      return outputWindow;
    }

    return this.openOutputWindow();
  }

  requestOutputFullscreen() {
    if (this._role !== APP_ROLE_EDITOR || !this._bridge) {
      return;
    }

    if (this._outputWindowConnected) {
      this._pendingOutputFullscreen = false;
      this._sendOutputCommand('enterFullscreen');
      return;
    }

    const outputWindow = this.openOutputWindow();
    if (!outputWindow) {
      return;
    }

    this._pendingOutputFullscreen = true;
    this._syncOutputWindowState();
  }

  start() {
    this.renderer.start();
    if (this._role === APP_ROLE_EDITOR) {
      this._broadcastSceneState();
    } else if (this._bridge) {
      this._bridge.send('requestAppState');
      this._bridge.send('outputReady');
    }
  }

  _wireShaderMasterStore() {
    this._shaderUiRevision = this.shaderMasterStore.getState().uiRevision;
    this._unsubscribeShaderMaster = this.shaderMasterStore.subscribe((state) => {
      this._applyShaderMasterStateToSurfaces();

      if (this.assistOverlay) {
        this.assistOverlay.update({
          surfaces: this.surfaces.serializeAll(),
          selectedSurfaceId: state.selectedSurfaceId,
        });
      }

      if (state.uiRevision === this._shaderUiRevision) {
        return;
      }

      this._shaderUiRevision = state.uiRevision;

      if (this.ui) {
        this._updateShaderMasterUi(state);
      }

      if (this._role === APP_ROLE_EDITOR) {
        this._scheduleSceneBroadcast();
      }
    });
  }

  _wireInput() {
    this.input.onQuadDrag = (surfaceId, quadType, subtractIndex, cornerIndex, x, y) => {
      const surface = this.surfaces.getSurface(surfaceId);
      if (!surface) return;
      surface.updateQuadCorner(quadType, cornerIndex, x, y, subtractIndex);
      this._scheduleSceneBroadcast();
    };

    this.input.onSurfaceSelect = (surfaceId, quadType, subtractIndex) => {
      this.surfaces.selectByHandle(surfaceId);
      this.shaderMasterStore.getState().setSelectedSurface(surfaceId);
      const surface = this.surfaces.activeSurface;
      if (surface && quadType === EDIT_TARGET_SUBTRACT && Number.isInteger(subtractIndex)) {
        surface.selectSubtractQuad(subtractIndex);
      }
      if (this.ui) {
        this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      }
      this._scheduleSceneBroadcast();
    };

    this.input.onDeletePressed = () => {
      this.surfaces.removeActiveSurface();
      this._syncShaderMasterSurfaces();
      if (this.ui) {
        this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      }
      this._scheduleSceneBroadcast();
    };

    this.input.onToggleShowMode = () => {
      if (this._activeModule === EDITOR_MODULE_GEO) {
        this.togglePreviewMode();
      }
    };
  }

  _wireUI() {
    this.ui.onModuleChange = (module) => {
      this.setActiveModule(module);
    };

    this.ui.onAddSurface = () => {
      const surface = this.surfaces.addSurface();
      this._syncShaderMasterSurfaces();
      const selectedOutputId = this.shaderMasterStore.getState().selectedOutputId;
      if (surface && selectedOutputId) {
        this.shaderMasterStore.getState().assignOutputToSurface(surface.id, selectedOutputId);
      }
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onFeatherChange = (value) => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      surface.updateFeather(value);
      this._scheduleSceneBroadcast();
    };

    this.ui.onSubtractFeatherChange = (value) => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.setSubtractQuadFeather(value)) return;
      this._scheduleSceneBroadcast();
    };

    this.ui.onEditTargetChange = (target) => {
      this.setEditTarget(target);
    };

    this.ui.onAddSubtractQuad = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      surface.addSubtractQuad();
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onRemoveSubtractQuad = () => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.removeActiveSubtractQuad()) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onCycleSubtractQuad = (direction) => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.cycleSubtractQuad(direction)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onSelectSubtractQuad = (index) => {
      const surface = this.surfaces.activeSurface;
      if (!surface) return;
      if (!surface.selectSubtractQuad(index)) return;
      this.ui.updateActiveSurface(surface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onToggleSurfaceVisibility = (surfaceId, visible) => {
      const surface = this.surfaces.all.find((entry) => entry.id === surfaceId);
      if (!surface) return;
      surface.setVisible(visible);
      this._syncShaderMasterSurfaces();
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onMoveSurfaceToIndex = (surfaceId, targetIndex) => {
      if (!this.surfaces.moveToIndex(surfaceId, targetIndex)) return;
      this._syncShaderMasterSurfaces();
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onOpenOutputWindow = () => {
      this.openOutputWindow();
    };

    this.ui.onFocusOutputWindow = () => {
      this.focusOutputWindow();
    };

    this.ui.onFullscreenOutputWindow = () => {
      this.requestOutputFullscreen();
    };

    this.ui.onPreviewModeChange = (mode) => {
      this.setPreviewMode(mode);
    };

    this.ui.onOutputDisplayModeChange = (mode) => {
      this.setOutputDisplayMode(mode);
    };

    this.ui.onSelectSurface = (surfaceId) => {
      this.surfaces.selectSurface(surfaceId);
      this.shaderMasterStore.getState().setSelectedSurface(surfaceId);
      this.ui.updateActiveSurface(this.surfaces.activeSurface, this.surfaces.count);
      this._scheduleSceneBroadcast();
    };

    this.ui.onAssignOutput = (surfaceId, outputId) => {
      this.shaderMasterStore.getState().assignOutputToSurface(surfaceId, outputId);
    };

    this.ui.onCreateOutput = (presetId) => {
      this.shaderMasterStore.getState().createOutput(presetId);
    };

    this.ui.onSelectOutput = (outputId) => {
      this.shaderMasterStore.getState().setSelectedOutput(outputId);
    };

    this.ui.onDuplicateOutput = (outputId) => {
      this.shaderMasterStore.getState().duplicateOutput(outputId);
    };

    this.ui.onDeleteOutput = (outputId) => {
      this.shaderMasterStore.getState().deleteOutput(outputId);
    };

    this.ui.onRenameOutput = (outputId, name) => {
      this.shaderMasterStore.getState().renameOutput(outputId, name);
    };

    this.ui.onSetOutputEnabled = (outputId, enabled) => {
      this.shaderMasterStore.getState().setOutputEnabled(outputId, enabled);
    };

    this.ui.onChangeOutputPreset = (outputId, presetId) => {
      this.shaderMasterStore.getState().changeOutputPreset(outputId, presetId);
    };

    this.ui.onUpdateOutputUniform = (outputId, key, value) => {
      this.shaderMasterStore.getState().updateOutputUniform(outputId, key, value);
    };

    this.ui.onSetAudioUniforms = (uniforms) => {
      this._manualAudioUniforms = {
        ...this._manualAudioUniforms,
        ...uniforms,
      };

      if (this.audioAnalyzer?.isRunning()) {
        this._updateShaderMasterUi();
        return;
      }

      this.shaderMasterStore.getState().setAudioUniforms(uniforms);
    };

    this.ui.onSetFeelingUniforms = (uniforms) => {
      this.shaderMasterStore.getState().setFeelingUniforms(uniforms);
    };

    this.ui.onResetAudioUniforms = () => {
      this._manualAudioUniforms = buildAudioDefaults();

      if (this.audioAnalyzer?.isRunning()) {
        this._updateShaderMasterUi();
        return;
      }

      this.shaderMasterStore.getState().setAudioUniforms(this._manualAudioUniforms);
    };

    this.ui.onResetFeelingUniforms = () => {
      this.shaderMasterStore.getState().resetFeelingUniforms();
    };

    this.ui.onResetAllDebugSignals = () => {
      const shaderState = this.shaderMasterStore.getState();
      this._manualAudioUniforms = buildAudioDefaults();

      if (this.audioAnalyzer?.isRunning()) {
        shaderState.resetAudioVisualMapping();
        shaderState.resetFeelingUniforms();
        shaderState.resetVisualStateRecipeState();
        this._updateShaderMasterUi();
        return;
      }

      shaderState.resetAllDebugSignals();
    };

    this.ui.onResetVisualStateRecipeState = () => {
      this.shaderMasterStore.getState().resetVisualStateRecipeState();
    };

    this.ui.onApplyVisualStateRecipe = (recipe) => {
      this.shaderMasterStore.getState().applyVisualStateRecipe(recipe);
    };

    this.ui.onStartMicrophoneAudio = async () => {
      await this._startMicrophoneAudioAnalyzer();
    };

    this.ui.onStartDisplayAudio = async () => {
      await this._startDisplayAudioAnalyzer();
    };

    this.ui.onStartAudioDebugTest = async (mode) => {
      await this._startAudioAnalyzerDebugTest(mode);
    };

    this.ui.onStopAudioAnalyzer = async () => {
      await this._stopAudioAnalyzer();
    };

    this.ui.onSetAudioAnalyzerDebugConfig = (patch) => {
      if (!this.audioAnalyzerStore) {
        return;
      }

      this.audioAnalyzerStore.setDebugConfig(patch);
      this._updateShaderMasterUi();
    };

    this.ui.onResetAudioAnalyzerDebugConfig = () => {
      if (!this.audioAnalyzerStore) {
        return;
      }

      this.audioAnalyzerStore.resetDebugConfig();
      this._updateShaderMasterUi();
    };

    this.ui.onRunAudioLatencyProbe = () => {
      this._runAudioLatencyProbe();
    };

    this.ui.onResetAudioLatencyProbe = () => {
      if (!this.audioAnalyzer) {
        return;
      }

      this.audioAnalyzer.resetLatencyProbe();
      this._updateShaderMasterUi();
    };

    this.ui.onSetAudioVisualSignalTuning = (key, patch) => {
      this.shaderMasterStore.getState().setAudioVisualSignalTuning(key, patch);
    };

    this.ui.onSetAudioVisualSoloKey = (key) => {
      this.shaderMasterStore.getState().setAudioVisualSoloKey(key);
    };

    this.ui.onResetAudioVisualMapping = () => {
      this.shaderMasterStore.getState().resetAudioVisualMapping();
    };
  }

  _wireFrameLoop() {
    this.renderer.onFrame((time) => {
      const frameTimeMs = time * 1000;
      let liveSignalsForFrame = null;
      if (this.audioAnalyzer?.isRunning()) {
        const liveSignals = this.audioAnalyzer.update(frameTimeMs);
        if (liveSignals) {
          liveSignalsForFrame = liveSignals;
          this.shaderMasterStore.getState().setAudioUniforms(
            audioSignalsToUniformPatch(liveSignals),
            { updateUiRevision: false },
          );
          this.audioAnalyzer.recordLatencyProbeSharedFrame(performance.now(), liveSignals);
          const aiFeatureSummary = this._aiFeatureTracker
            ? this._aiFeatureTracker.update(liveSignals, frameTimeMs)
            : null;
          if (aiFeatureSummary) {
            this._maybeRequestAIState(aiFeatureSummary, frameTimeMs);
          }
          this._refreshAudioDrivenUi(frameTimeMs);
          this._scheduleAudioDrivenBroadcast(frameTimeMs);
        }
      }

      this._syncAIStaleState(frameTimeMs);

      this.shaderRuntime.render(time);
      if (this.audioAnalyzer && liveSignalsForFrame) {
        this.audioAnalyzer.recordLatencyProbeRenderSubmission(performance.now(), liveSignalsForFrame);
      }
      this._applyShaderMasterStateToSurfaces();
      if (this.assistOverlay) {
        this.assistOverlay.resize(window.innerWidth, window.innerHeight);
        this.assistOverlay.render();
      }
    });
  }

  _wireBridge() {
    if (this._role === APP_ROLE_EDITOR) {
      this._bridge.on('requestAppState', () => {
        this._broadcastSceneState();
      });
      this._bridge.on('outputReady', () => {
        this._outputWindowConnected = true;
        this._syncOutputWindowState();
        this._broadcastSceneState();
        if (this._pendingOutputFullscreen) {
          this._pendingOutputFullscreen = false;
          this._sendOutputCommand('enterFullscreen');
        }
      });
      this._bridge.on('outputClosed', () => {
        this._outputWindowConnected = false;
        this._resolveOutputWindowRef();
        this._syncOutputWindowState();
      });
      return;
    }

    this._bridge.on('appState', (snapshot) => {
      this._applySceneSnapshot(snapshot);
    });
    this._bridge.on('outputCommand', (command) => {
      this._handleOutputCommand(command);
    });
  }

  _applyPreviewMode() {
    const showDebug = (
      this._role === APP_ROLE_EDITOR
      && this._activeModule === EDITOR_MODULE_GEO
      && this._previewMode === PREVIEW_MODE_EDIT
    );
    this.surfaces.setDebugVisible(showDebug);
    document.body.style.cursor = this._role === APP_ROLE_OUTPUT
      ? ((this.outputUi?.isFullscreenPromptVisible() ?? false) ? '' : 'none')
      : (showDebug ? '' : 'default');
  }

  _applyOutputDisplayMode() {
    if (this.assistOverlay) {
      this.assistOverlay.setMode(this._outputDisplayMode);
      this.assistOverlay.render();
    }
  }

  _syncShaderMasterSurfaces() {
    this.shaderMasterStore.getState().syncSurfaces(this._getSurfaceReferences());
    this.shaderMasterStore.getState().setSelectedSurface(this.surfaces.activeSurface?.id || null);
    this._updateShaderMasterUi();
  }

  _applyShaderMasterStateToSurfaces() {
    const shaderState = this.shaderMasterStore.getState();
    this.surfaces.all.forEach((surface) => {
      const assignedOutputId = shaderState.surfaceAssignments[surface.id] ?? null;
      surface.assignOutput(assignedOutputId);
      surface.setOutputTexture(this.shaderRuntime.getOutputTexture(assignedOutputId));
    });
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

  _getAudioAnalyzerUiState() {
    return this.audioAnalyzerStore ? this.audioAnalyzerStore.getState() : null;
  }

  _updateShaderMasterUi(shaderState = this.shaderMasterStore.getState()) {
    if (!this.ui) {
      return;
    }

    this.ui.updateShaderMaster(
      createShaderMasterSnapshot(shaderState),
      this._getAudioAnalyzerUiState(),
    );
  }

  _refreshAudioDrivenUi(frameTimeMs) {
    if (!this.ui) {
      return;
    }

    if ((frameTimeMs - this._lastAudioSnapshotRefreshMs) < 90) {
      return;
    }

    this._lastAudioSnapshotRefreshMs = frameTimeMs;
    this._updateShaderMasterUi();
  }

  _scheduleAudioDrivenBroadcast(frameTimeMs) {
    if ((frameTimeMs - this._lastAudioBroadcastMs) < 33) {
      return;
    }

    this._lastAudioBroadcastMs = frameTimeMs;
    this._scheduleSceneBroadcast();
  }

  _maybeRequestAIState(featureSummary, frameTimeMs) {
    const shaderState = this.shaderMasterStore.getState();
    if (!shaderState.aiState.aiEnabled || this._aiRequestInFlight) {
      return;
    }

    if (
      this._lastAIRequestStartedAtMs !== null
      && (frameTimeMs - this._lastAIRequestStartedAtMs) < AI_REQUEST_COOLDOWN_MS
    ) {
      return;
    }

    const updateReason = this._resolveAIUpdateReason(featureSummary, frameTimeMs);
    if (!updateReason) {
      return;
    }

    this._lastAIRequestStartedAtMs = frameTimeMs;
    this._aiRequestInFlight = true;
    console.debug('[AI Runtime] Requesting AI state.', {
      updateReason,
      featureSummary,
    });
    void this._requestAIState(featureSummary, updateReason, frameTimeMs);
  }

  _resolveAIUpdateReason(featureSummary, frameTimeMs) {
    if (this._lastAICommittedAtFrameMs === null) {
      if (frameTimeMs < AI_BOOT_WARMUP_MS) {
        return null;
      }

      if (
        featureSummary.activityConfidence >= 0.12
        || featureSummary.sectionState === 'breakdown'
        || frameTimeMs >= (AI_BOOT_WARMUP_MS * 2)
      ) {
        return 'boot';
      }

      return null;
    }

    const elapsedSinceCommit = frameTimeMs - this._lastAICommittedAtFrameMs;
    const sectionChanged = this._lastCommittedAISectionState !== null
      && featureSummary.sectionState !== this._lastCommittedAISectionState;
    const phraseChanged = this._lastCommittedAIPhraseState !== null
      && featureSummary.phraseState !== this._lastCommittedAIPhraseState;

    if (
      sectionChanged
      && elapsedSinceCommit >= AI_MIN_SECTION_UPDATE_INTERVAL_MS
      && featureSummary.changeStrength >= 0.16
    ) {
      return 'section-change';
    }

    if (
      phraseChanged
      && elapsedSinceCommit >= AI_MIN_PHRASE_UPDATE_INTERVAL_MS
      && featureSummary.changeStrength >= 0.1
      && featureSummary.activityConfidence >= 0.18
    ) {
      return 'phrase-change';
    }

    if (elapsedSinceCommit >= AI_MAX_UPDATE_INTERVAL_MS) {
      return featureSummary.activityConfidence >= 0.16
        ? 'phrase-refresh'
        : 'idle-refresh';
    }

    return null;
  }

  async _requestAIState(featureSummary, updateReason, frameTimeMs) {
    try {
      const shaderState = this.shaderMasterStore.getState();
      const previousAIState = shaderState.aiState.currentAIState;
      const nextAIState = await getAIState(featureSummary, {
        previousAIState,
        updateReason,
      });
      const requestMeta = getLastAIRequestMeta();
      const nextLastAIUpdateTime = requestMeta.fallbackActive
        ? shaderState.aiState.lastAIUpdateTime
        : (requestMeta.receivedAtMs || Date.now());
      const storedAIState = requestMeta.fallbackActive
        ? previousAIState
        : blendAIState(previousAIState, nextAIState, getAIBlendAmount(updateReason));

      this.shaderMasterStore.getState().setAIState({
        currentAIState: storedAIState,
        lastAIUpdateTime: nextLastAIUpdateTime,
        aiFallbackActive: requestMeta.fallbackActive,
        aiStale: this._computeAIStale(nextLastAIUpdateTime),
        musicalState: {
          phraseState: featureSummary.phraseState,
          sectionState: featureSummary.sectionState,
          activityConfidence: featureSummary.activityConfidence,
          changeStrength: featureSummary.changeStrength,
          lastCommitReason: requestMeta.fallbackActive
            ? shaderState.aiState.musicalState.lastCommitReason
            : updateReason,
        },
      });

      if (!requestMeta.fallbackActive) {
        this._lastAICommittedAtFrameMs = frameTimeMs;
        this._lastCommittedAIPhraseState = featureSummary.phraseState;
        this._lastCommittedAISectionState = featureSummary.sectionState;
      }

      console.debug('[AI Runtime] Current AI state updated.', {
        updateReason,
        currentAIState: storedAIState,
        rawAIState: nextAIState,
        phraseState: featureSummary.phraseState,
        sectionState: featureSummary.sectionState,
        activityConfidence: featureSummary.activityConfidence,
        changeStrength: featureSummary.changeStrength,
        lastAIUpdateTime: nextLastAIUpdateTime,
        aiFallbackActive: requestMeta.fallbackActive,
        aiStale: this._computeAIStale(nextLastAIUpdateTime),
      });

      this._updateShaderMasterUi();
      this._scheduleSceneBroadcast();
    } finally {
      this._aiRequestInFlight = false;
    }
  }

  _computeAIStale(lastAIUpdateTime, frameTimeMs = null) {
    if (lastAIUpdateTime !== null) {
      return (Date.now() - lastAIUpdateTime) > AI_STALE_THRESHOLD_MS;
    }

    if (frameTimeMs === null || this._lastAIRequestStartedAtMs === null) {
      return false;
    }

    return (frameTimeMs - this._lastAIRequestStartedAtMs) > AI_STALE_THRESHOLD_MS;
  }

  _syncAIStaleState(frameTimeMs) {
    const shaderState = this.shaderMasterStore.getState();
    if (!shaderState.aiState.aiEnabled) {
      return;
    }

    const nextStale = this._computeAIStale(shaderState.aiState.lastAIUpdateTime, frameTimeMs);
    if (nextStale === shaderState.aiState.aiStale) {
      return;
    }

    console.debug('[AI Runtime] AI stale status changed.', {
      aiStale: nextStale,
      lastAIUpdateTime: shaderState.aiState.lastAIUpdateTime,
      aiFallbackActive: shaderState.aiState.aiFallbackActive,
    });
    this.shaderMasterStore.getState().setAIState({
      aiStale: nextStale,
    });
    this._updateShaderMasterUi();
    this._scheduleSceneBroadcast();
  }

  async _startMicrophoneAudioAnalyzer() {
    if (!this.audioAnalyzer) {
      return;
    }

    try {
      const startPromise = this.audioAnalyzer.startMicrophone();
      this._updateShaderMasterUi();
      await startPromise;
      this.shaderMasterStore.getState().setAudioUniforms(
        audioSignalsToUniformPatch(this.audioAnalyzer.getAudioSignals()),
      );
      this._updateShaderMasterUi();
      this._scheduleSceneBroadcast();
    } catch (error) {
      console.error('Audio Analyzer v1 failed to start microphone capture.', error);
      this._updateShaderMasterUi();
    }
  }

  async _startDisplayAudioAnalyzer() {
    if (!this.audioAnalyzer) {
      return;
    }

    try {
      const startPromise = this.audioAnalyzer.startDisplayAudio();
      this._updateShaderMasterUi();
      await startPromise;
      this.shaderMasterStore.getState().setAudioUniforms(
        audioSignalsToUniformPatch(this.audioAnalyzer.getAudioSignals()),
      );
      this._updateShaderMasterUi();
      this._scheduleSceneBroadcast();
    } catch (error) {
      console.error('Audio Analyzer v1 failed to start display audio capture.', error);
      this._updateShaderMasterUi();
    }
  }

  async _startAudioAnalyzerDebugTest(mode) {
    if (!this.audioAnalyzer) {
      return;
    }

    try {
      const startPromise = this.audioAnalyzer.startDebugTest(mode);
      this._updateShaderMasterUi();
      await startPromise;
      this.shaderMasterStore.getState().setAudioUniforms(
        audioSignalsToUniformPatch(this.audioAnalyzer.getAudioSignals()),
      );
      this._updateShaderMasterUi();
      this._scheduleSceneBroadcast();
    } catch (error) {
      console.error(`Audio Analyzer debug test failed to start for ${mode}.`, error);
      this._updateShaderMasterUi();
    }
  }

  async _stopAudioAnalyzer() {
    if (!this.audioAnalyzer) {
      return;
    }

    await this.audioAnalyzer.stop();
    this.shaderMasterStore.getState().setAudioUniforms(this._manualAudioUniforms);
    this._updateShaderMasterUi();
    this._scheduleSceneBroadcast();
  }

  _runAudioLatencyProbe() {
    if (!this.audioAnalyzer) {
      return;
    }

    this.audioAnalyzer.triggerLatencyProbe();
    this._updateShaderMasterUi();
  }

  _createSceneSnapshot() {
    return {
      editTarget: this._editTarget,
      previewMode: this._previewMode,
      outputDisplayMode: this._outputDisplayMode,
      surfaces: this.surfaces.serializeAll(),
      shaderMaster: createShaderMasterSnapshot(this.shaderMasterStore.getState()),
    };
  }

  _applySceneSnapshot(snapshot) {
    if (!snapshot) return;

    this._editTarget = snapshot.editTarget ?? this._editTarget;
    this._previewMode = PREVIEW_MODE_OUTPUT;
    this._outputDisplayMode = snapshot.outputDisplayMode ?? this._outputDisplayMode;

    this.surfaces.syncSerialized(snapshot.surfaces || []);
    if (snapshot.shaderMaster) {
      this.shaderMasterStore.getState().hydrateSnapshot(snapshot.shaderMaster);
    }

    const selectedSurfaceId = snapshot.shaderMaster?.selectedSurfaceId || null;
    this.surfaces.selectSurface(selectedSurfaceId);
    this.surfaces.setEditTarget(this._editTarget);
    this._applyPreviewMode();
    this._applyOutputDisplayMode();
    this._applyShaderMasterStateToSurfaces();
  }

  _scheduleSceneBroadcast() {
    if (this._role !== APP_ROLE_EDITOR || !this._bridge || this._pendingBroadcastFrame !== null) {
      return;
    }

    this._pendingBroadcastFrame = requestAnimationFrame(() => {
      this._pendingBroadcastFrame = null;
      this._broadcastSceneState();
    });
  }

  _broadcastSceneState() {
    if (this._role !== APP_ROLE_EDITOR || !this._bridge) {
      return;
    }

    this._bridge.send('appState', this._createSceneSnapshot());
  }

  _resolveOutputWindowRef() {
    if (this._outputWindowRef?.closed) {
      this._outputWindowRef = null;
    }

    return this._outputWindowRef;
  }

  _navigateOutputWindow(outputWindow, targetUrl) {
    if (!outputWindow) {
      return null;
    }

    try {
      if (outputWindow.location.href !== targetUrl) {
        outputWindow.location.replace(targetUrl);
      }
    } catch (error) {
      outputWindow.location = targetUrl;
    }

    return outputWindow;
  }

  _syncOutputWindowState() {
    if (!this.ui) {
      return;
    }

    this.ui.setOutputWindowState({
      available: Boolean(this._resolveOutputWindowRef()),
      connected: this._outputWindowConnected,
    });
  }

  _sendOutputCommand(type, payload = {}) {
    if (this._role !== APP_ROLE_EDITOR || !this._bridge) {
      return;
    }

    this._bridge.send('outputCommand', {
      type,
      payload,
    });
  }

  _handleOutputCommand(command) {
    if (this._role !== APP_ROLE_OUTPUT || !command?.type) {
      return;
    }

    if (command.type === 'enterFullscreen') {
      this._requestStageFullscreen(
        'The main window requested fullscreen, but this browser needs a direct click in the output window to continue.',
      );
    }
  }

  _requestStageFullscreen(fallbackMessage) {
    if (this._role !== APP_ROLE_OUTPUT) {
      return Promise.resolve(false);
    }

    if (document.fullscreenElement) {
      this.outputUi?.hideFullscreenPrompt();
      this._applyPreviewMode();
      return Promise.resolve(true);
    }

    const fullscreenTarget = document.documentElement;
    if (!fullscreenTarget?.requestFullscreen) {
      this.outputUi?.showFullscreenPrompt(
        fallbackMessage || 'This browser does not allow automatic fullscreen here. Click below to try again.',
      );
      this._applyPreviewMode();
      return Promise.resolve(false);
    }

    return fullscreenTarget.requestFullscreen()
      .then(() => {
        this.outputUi?.hideFullscreenPrompt();
        this._applyPreviewMode();
        return true;
      })
      .catch(() => {
        this.outputUi?.showFullscreenPrompt(
          fallbackMessage || 'Fullscreen was blocked until this window receives the click directly.',
        );
        this._applyPreviewMode();
        return false;
      });
  }

  dispose() {
    if (this._pendingBroadcastFrame !== null) {
      cancelAnimationFrame(this._pendingBroadcastFrame);
      this._pendingBroadcastFrame = null;
    }
    if (this._role === APP_ROLE_OUTPUT && this._bridge) {
      this._bridge.send('outputClosed');
    }
    if (this._unsubscribeShaderMaster) this._unsubscribeShaderMaster();
    if (this.input) this.input.dispose();
    if (this.ui) this.ui.dispose();
    if (this.outputUi) this.outputUi.dispose();
    if (this.assistOverlay) this.assistOverlay.dispose();
    if (this._windowCrtOverlay) this._windowCrtOverlay.remove();
    this.shaderRuntime.dispose();
    this.renderer.dispose();
    if (this._bridge) this._bridge.dispose();
  }
}
