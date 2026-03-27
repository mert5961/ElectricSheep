import {
  EDIT_TARGET_CONTENT,
  EDIT_TARGET_SUBTRACT,
  EDIT_TARGET_SURFACE,
  MAX_SUBTRACT_FEATHER,
  MAX_SURFACE_FEATHER,
} from '../surfaces/SurfaceConstants.js';
import {
  EDITOR_MODULE_GEO,
  EDITOR_MODULE_SHADER,
  OUTPUT_DISPLAY_MODE_CALIBRATION,
  OUTPUT_DISPLAY_MODE_MAPPING_ASSIST,
  OUTPUT_DISPLAY_MODE_SHOW,
  PREVIEW_MODE_EDIT,
  PREVIEW_MODE_OUTPUT,
} from '../core/AppModes.js';
import { ShaderTab } from '../systems/shader-master/ui/ShaderTab.ts';
import './retro-ui.css';

function createText(tagName, text, className = '') {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

export class UIManager {
  constructor(uiEl) {
    this._uiEl = uiEl;
    this._activeModule = EDITOR_MODULE_GEO;
    this._previewMode = PREVIEW_MODE_EDIT;
    this._outputDisplayMode = OUTPUT_DISPLAY_MODE_SHOW;
    this._editTarget = EDIT_TARGET_SURFACE;
    this._hasActiveSurface = false;
    this._outputWindowState = {
      available: false,
      connected: false,
    };
    this._shaderMasterSnapshot = null;
    this._audioAnalyzerState = null;
    this._geoSurfaceListSignature = '';

    this._shell = null;
    this._topbar = null;
    this._bottomNav = null;
    this._content = null;
    this._geoModuleEl = null;
    this._shaderModuleEl = null;
    this._moduleButtons = new Map();
    this._previewButtons = new Map();
    this._outputModeButtons = new Map();
    this._editTargetButtons = new Map();
    this._surfaceLabel = null;
    this._surfaceMetaLabel = null;
    this._surfaceOrderLabel = null;
    this._subtractLabel = null;
    this._featherSlider = null;
    this._featherLabel = null;
    this._subtractFeatherSlider = null;
    this._subtractFeatherLabel = null;
    this._addSubtractBtn = null;
    this._removeSubtractBtn = null;
    this._prevSubtractBtn = null;
    this._nextSubtractBtn = null;
    this._bringToFrontBtn = null;
    this._sendToBackBtn = null;
    this._moveForwardBtn = null;
    this._moveBackwardBtn = null;
    this._openOutputBtn = null;
    this._focusOutputBtn = null;
    this._fullscreenOutputBtn = null;
    this._outputStatusBadge = null;
    this._geoSurfaceListEl = null;
    this._geoStagePreviewBadge = null;
    this._geoStageModeBadge = null;
    this._shaderSummaryEl = null;
    this._shaderMasterPanel = null;
    this._stageCanvasFrame = null;

    this.onModuleChange = null;
    this.onAddSurface = null;
    this.onFeatherChange = null;
    this.onSubtractFeatherChange = null;
    this.onEditTargetChange = null;
    this.onAddSubtractQuad = null;
    this.onRemoveSubtractQuad = null;
    this.onCycleSubtractQuad = null;
    this.onBringToFront = null;
    this.onSendToBack = null;
    this.onMoveForward = null;
    this.onMoveBackward = null;
    this.onOpenOutputWindow = null;
    this.onFocusOutputWindow = null;
    this.onFullscreenOutputWindow = null;
    this.onPreviewModeChange = null;
    this.onOutputDisplayModeChange = null;
    this.onSelectSurface = null;
    this.onAssignOutput = null;
    this.onCreateOutput = null;
    this.onSelectOutput = null;
    this.onDuplicateOutput = null;
    this.onDeleteOutput = null;
    this.onRenameOutput = null;
    this.onSetOutputEnabled = null;
    this.onChangeOutputPreset = null;
    this.onUpdateOutputUniform = null;
    this.onSetAudioUniforms = null;
    this.onSetFeelingUniforms = null;
    this.onResetAudioUniforms = null;
    this.onResetFeelingUniforms = null;
    this.onResetAllDebugSignals = null;
    this.onResetVisualStateRecipeState = null;
    this.onApplyVisualStateRecipe = null;
    this.onStartMicrophoneAudio = null;
    this.onStartDisplayAudio = null;
    this.onStartAudioDebugTest = null;
    this.onStopAudioAnalyzer = null;
    this.onSetAudioAnalyzerDebugConfig = null;
    this.onResetAudioAnalyzerDebugConfig = null;
    this.onRunAudioLatencyProbe = null;
    this.onResetAudioLatencyProbe = null;
    this.onSetAudioVisualSignalTuning = null;
    this.onSetAudioVisualSoloKey = null;
    this.onResetAudioVisualMapping = null;

    this._build();
  }

  setActiveModule(module) {
    if (module !== EDITOR_MODULE_GEO && module !== EDITOR_MODULE_SHADER) {
      return;
    }

    this._activeModule = module;
    this._syncModuleButtons();
    this._syncModuleVisibility();
  }

  setOutputWindowState({ available, connected }) {
    this._outputWindowState = {
      available: Boolean(available),
      connected: Boolean(connected),
    };
    this._syncOutputWindowControls();
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

  setPreviewMode(mode) {
    if (mode !== PREVIEW_MODE_EDIT && mode !== PREVIEW_MODE_OUTPUT) {
      return;
    }

    this._previewMode = mode;
    this._syncPreviewButtons();
    this._syncGeoStageBadges();
  }

  setOutputDisplayMode(mode) {
    if (
      mode !== OUTPUT_DISPLAY_MODE_SHOW &&
      mode !== OUTPUT_DISPLAY_MODE_MAPPING_ASSIST &&
      mode !== OUTPUT_DISPLAY_MODE_CALIBRATION
    ) {
      return;
    }

    this._outputDisplayMode = mode;
    this._syncOutputModeButtons();
    this._syncGeoStageBadges();
  }

  updateActiveSurface(surface, surfaceCount = 0) {
    this._hasActiveSurface = Boolean(surface);

    if (surface) {
      if (this._surfaceLabel) {
        this._surfaceLabel.textContent = surface.name;
      }
      if (this._surfaceMetaLabel) {
        this._surfaceMetaLabel.textContent = `Editing ${this._describeEditTarget(this._editTarget)} on the shared stage`;
      }
      const resolvedSurfaceCount = Math.max(surfaceCount, surface.order + 1);
      this._surfaceOrderLabel.textContent = `Layer ${surface.order + 1}/${resolvedSurfaceCount}`;
      this._featherSlider.value = String(surface.feather);
      this._featherLabel.textContent = surface.feather.toFixed(2);
      this._featherSlider.disabled = false;
      this._subtractLabel.textContent = surface.subtractQuadCount > 0
        ? `Subtract ${surface.activeSubtractQuadIndex + 1}/${surface.subtractQuadCount}`
        : 'No subtract quads';
      this._subtractFeatherSlider.value = String(surface.activeSubtractFeather);
      this._subtractFeatherLabel.textContent = surface.activeSubtractFeather.toFixed(2);
      this._subtractFeatherSlider.disabled = surface.subtractQuadCount === 0;
    } else {
      if (this._surfaceLabel) {
        this._surfaceLabel.textContent = 'No surface selected';
      }
      if (this._surfaceMetaLabel) {
        this._surfaceMetaLabel.textContent = 'Add a surface or click one directly on the stage to begin mapping.';
      }
      this._surfaceOrderLabel.textContent = 'No layer';
      this._featherSlider.value = '0';
      this._featherLabel.textContent = '0.00';
      this._featherSlider.disabled = true;
      this._subtractLabel.textContent = 'No subtract quads';
      this._subtractFeatherSlider.value = '0';
      this._subtractFeatherLabel.textContent = '0.00';
      this._subtractFeatherSlider.disabled = true;
    }

    this._syncEditTargetButtons();
    this._syncSubtractButtons(surface);
    this._syncSurfaceOrderButtons(surface, surfaceCount);
  }

  updateShaderMaster(snapshot, audioAnalyzerState = this._audioAnalyzerState) {
    this._shaderMasterSnapshot = snapshot;
    this._audioAnalyzerState = audioAnalyzerState;

    if (this._shaderMasterPanel && snapshot) {
      this._shaderMasterPanel.update(snapshot, this._audioAnalyzerState);
    }

    this._syncGeoSurfaceList();
    this._syncShaderSummary();
  }

  _build() {
    this._shell = document.createElement('div');
    this._shell.className = 'es-ui-shell';

    const vignetteOverlay = document.createElement('div');
    vignetteOverlay.className = 'es-vignette-overlay';

    const scanlineOverlay = document.createElement('div');
    scanlineOverlay.className = 'es-scanline-overlay';

    const dustOverlay = document.createElement('div');
    dustOverlay.className = 'es-dust-overlay';

    this._topbar = this._buildTopbar();
    this._bottomNav = this._buildBottomNav();
    this._content = document.createElement('div');
    this._content.className = 'es-ui-content';

    this._geoModuleEl = this._buildGeoModule();
    this._shaderModuleEl = this._buildShaderModule();

    this._content.append(this._geoModuleEl, this._shaderModuleEl);
    this._shell.append(vignetteOverlay, scanlineOverlay, dustOverlay, this._topbar, this._content, this._bottomNav);
    this._uiEl.append(this._shell);

    this._syncModuleButtons();
    this._syncModuleVisibility({ immediate: true });
    this._syncPreviewButtons();
    this._syncOutputModeButtons();
    this._syncEditTargetButtons();
    this._syncSubtractButtons(null);
    this._syncSurfaceOrderButtons(null, 0);
    this._syncOutputWindowControls();
    this._syncGeoStageBadges();
    this._syncShaderSummary();
  }

  _buildTopbar() {
    const bar = document.createElement('div');
    bar.className = 'es-retro-panel es-topbar';

    const identity = document.createElement('div');
    identity.className = 'es-topbar__identity';
    identity.append(
      createText('div', 'ELECTRIC_SHEEP', 'es-text-title'),
      createText('div', 'GEO_ENGINE / SHADER_ROUTING', 'es-text-subtitle'),
    );

    const controls = document.createElement('div');
    controls.className = 'es-topbar__controls';

    const status = document.createElement('div');
    status.className = 'es-topbar__status';

    this._outputStatusBadge = this._createBadge('Output Offline');
    this._outputStatusBadge.classList.add('es-output-badge');
    status.append(this._outputStatusBadge);

    const actions = document.createElement('div');
    actions.className = 'es-topbar__actions';
    this._openOutputBtn = this._createButton('Open Output', () => {
      if (this.onOpenOutputWindow) this.onOpenOutputWindow();
    }, { active: true });
    this._focusOutputBtn = this._createButton('Focus Output', () => {
      if (this.onFocusOutputWindow) this.onFocusOutputWindow();
    });
    this._fullscreenOutputBtn = this._createButton('Fullscreen Output', () => {
      if (this.onFullscreenOutputWindow) this.onFullscreenOutputWindow();
    });

    actions.append(
      this._openOutputBtn,
      this._focusOutputBtn,
      this._fullscreenOutputBtn,
    );
    controls.append(status, actions);

    bar.append(identity, controls);
    return bar;
  }

  _buildBottomNav() {
    const nav = document.createElement('div');
    nav.className = 'es-retro-panel es-bottom-nav';
    nav.append(
      this._createModuleButton('GEO', EDITOR_MODULE_GEO),
      this._createModuleButton('SHADER', EDITOR_MODULE_SHADER),
    );
    return nav;
  }

  _buildGeoModule() {
    const moduleEl = document.createElement('div');
    moduleEl.className = 'es-module es-module--geo';

    const controlsCard = this._createCard('es-card--controls');
    controlsCard.append(
      this._createBracketHeader('GEO_WORKSPACE'),
    );

    const addSurfaceBtn = this._createButton('+ Add Surface', () => {
      if (this.onAddSurface) this.onAddSurface();
    }, { active: true, fullWidth: true });

    const workspaceSection = this._createSection('Workspace');
    const previewGroup = this._createInlineGroup('Preview');
    previewGroup.row.append(
      this._createPreviewButton('Edit', PREVIEW_MODE_EDIT),
      this._createPreviewButton('Output', PREVIEW_MODE_OUTPUT),
    );
    const outputModeGroup = this._createInlineGroup('Stage');
    outputModeGroup.row.append(
      this._createOutputModeButton('Show', OUTPUT_DISPLAY_MODE_SHOW),
      this._createOutputModeButton('Mapping', OUTPUT_DISPLAY_MODE_MAPPING_ASSIST),
      this._createOutputModeButton('Calibration', OUTPUT_DISPLAY_MODE_CALIBRATION),
    );
    workspaceSection.append(previewGroup.element, outputModeGroup.element);

    const editSection = this._createSection('Edit Target');
    const editButtons = document.createElement('div');
    editButtons.className = 'es-grid-3col';
    editButtons.append(
      this._createEditTargetButton('Surface', EDIT_TARGET_SURFACE),
      this._createEditTargetButton('Content', EDIT_TARGET_CONTENT),
      this._createEditTargetButton('Subtract', EDIT_TARGET_SUBTRACT),
    );
    editSection.append(editButtons);

    const layerSection = this._createSection('Layer Order');
    this._surfaceOrderLabel = this._createBadge('No layer');
    const orderButtons = document.createElement('div');
    orderButtons.className = 'es-grid-2col';
    this._sendToBackBtn = this._createButton('To Back', () => {
      if (this.onSendToBack) this.onSendToBack();
    });
    this._moveBackwardBtn = this._createButton('Backward', () => {
      if (this.onMoveBackward) this.onMoveBackward();
    });
    this._moveForwardBtn = this._createButton('Forward', () => {
      if (this.onMoveForward) this.onMoveForward();
    });
    this._bringToFrontBtn = this._createButton('To Front', () => {
      if (this.onBringToFront) this.onBringToFront();
    });
    orderButtons.append(
      this._sendToBackBtn,
      this._moveBackwardBtn,
      this._moveForwardBtn,
      this._bringToFrontBtn,
    );
    layerSection.append(this._surfaceOrderLabel, orderButtons);

    const featherSection = this._createSection('Feather & Masking');
    const surfaceFeatherGroup = this._createSliderGroup('Surface Feather', MAX_SURFACE_FEATHER, (value) => {
      if (this.onFeatherChange) this.onFeatherChange(value);
    });
    this._featherSlider = surfaceFeatherGroup.input;
    this._featherLabel = surfaceFeatherGroup.valueLabel;
    featherSection.append(surfaceFeatherGroup.element);

    this._subtractLabel = this._createBadge('No subtract quads');
    const subtractActions = document.createElement('div');
    subtractActions.className = 'es-grid-2col';
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
    subtractActions.append(
      this._addSubtractBtn,
      this._removeSubtractBtn,
      this._prevSubtractBtn,
      this._nextSubtractBtn,
    );
    const subtractFeatherGroup = this._createSliderGroup('Subtract Feather', MAX_SUBTRACT_FEATHER, (value) => {
      if (this.onSubtractFeatherChange) this.onSubtractFeatherChange(value);
    });
    this._subtractFeatherSlider = subtractFeatherGroup.input;
    this._subtractFeatherLabel = subtractFeatherGroup.valueLabel;
    featherSection.append(this._subtractLabel, subtractActions, subtractFeatherGroup.element);

    controlsCard.append(
      addSurfaceBtn,
      workspaceSection,
      editSection,
      layerSection,
      featherSection,
    );

    const stageCard = this._createCard('es-card--stage');
    const stageTop = document.createElement('div');
    stageTop.className = 'es-stage__top';
    const stageCopy = document.createElement('div');
    stageCopy.className = 'es-stage__copy';
    stageCopy.append(
      createText('div', 'GEO', 'es-text-title-xl'),
    );
    const stageBadges = document.createElement('div');
    stageBadges.className = 'es-stage__badges';
    this._geoStagePreviewBadge = this._createBadge('Preview: Edit');
    this._geoStageModeBadge = this._createBadge('Stage: Show');
    stageBadges.append(this._geoStagePreviewBadge, this._geoStageModeBadge);
    stageTop.append(stageCopy, stageBadges);

    this._stageCanvasFrame = document.createElement('div');
    this._stageCanvasFrame.className = 'es-retro-stage-frame es-stage__canvas-frame';

    stageCard.append(stageTop, this._stageCanvasFrame);

    const surfacesCard = this._createCard('es-card--surfaces');
    surfacesCard.append(
      this._createBracketHeader('SURFACE_NAV'),
    );
    this._geoSurfaceListEl = document.createElement('div');
    this._geoSurfaceListEl.className = 'es-surface-list';
    surfacesCard.append(this._geoSurfaceListEl);

    const leftRail = document.createElement('div');
    leftRail.className = 'es-geo-rail es-geo-rail--left';
    leftRail.append(controlsCard);

    const stageColumn = document.createElement('div');
    stageColumn.className = 'es-geo-stage-column';
    stageColumn.append(stageCard);

    const rightRail = document.createElement('div');
    rightRail.className = 'es-geo-rail es-geo-rail--right';
    rightRail.append(surfacesCard);

    moduleEl.append(leftRail, stageColumn, rightRail);
    return moduleEl;
  }

  _buildShaderModule() {
    const moduleEl = document.createElement('div');
    moduleEl.className = 'es-module es-module--shader';

    const bodyCard = this._createCard('es-card--shader-body');
    bodyCard.append(this._createBracketHeader('SHADER_ROUTER'));

    this._shaderSummaryEl = createText('div', '', 'es-text-subtitle');
    bodyCard.append(this._shaderSummaryEl);

    const panelWrap = document.createElement('div');
    panelWrap.className = 'es-panel-wrap es-panel-wrap--shader';

    this._shaderMasterPanel = new ShaderTab({
      onSelectSurface: (surfaceId) => {
        if (this.onSelectSurface) this.onSelectSurface(surfaceId);
      },
      onAssignOutput: (surfaceId, outputId) => {
        if (this.onAssignOutput) this.onAssignOutput(surfaceId, outputId);
      },
      onCreateOutput: (presetId) => {
        if (this.onCreateOutput) this.onCreateOutput(presetId);
      },
      onSelectOutput: (outputId) => {
        if (this.onSelectOutput) this.onSelectOutput(outputId);
      },
      onDuplicateOutput: (outputId) => {
        if (this.onDuplicateOutput) this.onDuplicateOutput(outputId);
      },
      onDeleteOutput: (outputId) => {
        if (this.onDeleteOutput) this.onDeleteOutput(outputId);
      },
      onRenameOutput: (outputId, name) => {
        if (this.onRenameOutput) this.onRenameOutput(outputId, name);
      },
      onSetOutputEnabled: (outputId, enabled) => {
        if (this.onSetOutputEnabled) this.onSetOutputEnabled(outputId, enabled);
      },
      onChangeOutputPreset: (outputId, presetId) => {
        if (this.onChangeOutputPreset) this.onChangeOutputPreset(outputId, presetId);
      },
      onUpdateOutputUniform: (outputId, key, value) => {
        if (this.onUpdateOutputUniform) this.onUpdateOutputUniform(outputId, key, value);
      },
      onSetAudioUniforms: (uniforms) => {
        if (this.onSetAudioUniforms) this.onSetAudioUniforms(uniforms);
      },
      onSetFeelingUniforms: (uniforms) => {
        if (this.onSetFeelingUniforms) this.onSetFeelingUniforms(uniforms);
      },
      onResetAudioUniforms: () => {
        if (this.onResetAudioUniforms) this.onResetAudioUniforms();
      },
      onResetFeelingUniforms: () => {
        if (this.onResetFeelingUniforms) this.onResetFeelingUniforms();
      },
      onResetAllDebugSignals: () => {
        if (this.onResetAllDebugSignals) this.onResetAllDebugSignals();
      },
      onResetVisualStateRecipeState: () => {
        if (this.onResetVisualStateRecipeState) this.onResetVisualStateRecipeState();
      },
      onApplyVisualStateRecipe: (recipe) => {
        if (this.onApplyVisualStateRecipe) this.onApplyVisualStateRecipe(recipe);
      },
      onStartMicrophoneAudio: () => {
        if (this.onStartMicrophoneAudio) this.onStartMicrophoneAudio();
      },
      onStartDisplayAudio: () => {
        if (this.onStartDisplayAudio) this.onStartDisplayAudio();
      },
      onStartAudioDebugTest: (mode) => {
        if (this.onStartAudioDebugTest) this.onStartAudioDebugTest(mode);
      },
      onStopAudioAnalyzer: () => {
        if (this.onStopAudioAnalyzer) this.onStopAudioAnalyzer();
      },
      onSetAudioAnalyzerDebugConfig: (patch) => {
        if (this.onSetAudioAnalyzerDebugConfig) this.onSetAudioAnalyzerDebugConfig(patch);
      },
      onResetAudioAnalyzerDebugConfig: () => {
        if (this.onResetAudioAnalyzerDebugConfig) this.onResetAudioAnalyzerDebugConfig();
      },
      onRunAudioLatencyProbe: () => {
        if (this.onRunAudioLatencyProbe) this.onRunAudioLatencyProbe();
      },
      onResetAudioLatencyProbe: () => {
        if (this.onResetAudioLatencyProbe) this.onResetAudioLatencyProbe();
      },
      onSetAudioVisualSignalTuning: (key, patch) => {
        if (this.onSetAudioVisualSignalTuning) this.onSetAudioVisualSignalTuning(key, patch);
      },
      onSetAudioVisualSoloKey: (key) => {
        if (this.onSetAudioVisualSoloKey) this.onSetAudioVisualSoloKey(key);
      },
      onResetAudioVisualMapping: () => {
        if (this.onResetAudioVisualMapping) this.onResetAudioVisualMapping();
      },
    });

    panelWrap.append(this._shaderMasterPanel.element);
    bodyCard.append(panelWrap);

    moduleEl.append(bodyCard);
    return moduleEl;
  }

  _createModuleButton(label, module) {
    const button = this._createButton(label, () => {
      if (module === this._activeModule) {
        return;
      }
      if (this.onModuleChange) {
        this.onModuleChange(module);
      }
    }, { nav: true });
    this._moduleButtons.set(module, button);
    return button;
  }

  _createBracketHeader(label) {
    const header = document.createElement('div');
    header.className = 'es-bracket-header';
    header.append(
      createText('div', label, 'es-bracket-header__label'),
      createText('div', '', 'es-bracket-header__line'),
    );
    return header;
  }

  _createPreviewButton(label, mode) {
    const button = this._createButton(label, () => {
      if (this.onPreviewModeChange) this.onPreviewModeChange(mode);
    });
    this._previewButtons.set(mode, button);
    return button;
  }

  _createOutputModeButton(label, mode) {
    const button = this._createButton(label, () => {
      if (this.onOutputDisplayModeChange) this.onOutputDisplayModeChange(mode);
    });
    this._outputModeButtons.set(mode, button);
    return button;
  }

  _createEditTargetButton(label, target) {
    const button = this._createButton(label, () => {
      if (!this._hasActiveSurface) return;
      if (this.onEditTargetChange) this.onEditTargetChange(target);
    });
    this._editTargetButtons.set(target, button);
    return button;
  }

  _createSection(label) {
    const section = document.createElement('div');
    section.className = 'es-retro-section es-section';
    section.append(createText('div', label, 'es-text-section-label'));
    return section;
  }

  _createInlineGroup(label) {
    const group = document.createElement('div');
    group.className = 'es-inline-group';
    group.append(createText('div', label, 'es-text-label'));
    const row = document.createElement('div');
    row.className = 'es-inline-group__row';
    group.append(row);
    return { element: group, row };
  }

  _createCard(extraClass = '') {
    const card = document.createElement('div');
    card.className = `es-retro-panel es-card ${extraClass}`.trim();
    return card;
  }

  _createBadge(text, useAccent = false) {
    const badge = document.createElement('div');
    badge.textContent = text;
    badge.className = `es-retro-badge es-badge${useAccent ? ' es-badge--accent' : ''}`;
    return badge;
  }

  _createSliderGroup(label, maxValue, onChange) {
    const group = document.createElement('div');
    group.className = 'es-slider';

    const header = document.createElement('div');
    header.className = 'es-slider__header';

    const title = createText('div', label, 'es-slider__title');
    const valueLabel = createText('div', '0.00', 'es-slider__value');

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(maxValue);
    input.step = '0.005';
    input.value = '0';
    input.disabled = true;
    input.className = 'es-slider__input';
    input.addEventListener('input', (event) => {
      const value = Number.parseFloat(event.target.value);
      valueLabel.textContent = value.toFixed(2);
      onChange(value);
    });

    header.append(title, valueLabel);
    group.append(header, input);
    return { element: group, input, valueLabel };
  }

  _createButton(label, onClick, {
    active = false,
    pill = false,
    fullWidth = false,
    nav = false,
  } = {}) {
    const button = document.createElement('button');
    let classes = 'es-retro-button es-btn';
    if (active) classes += ' es-btn--active';
    if (pill) classes += ' es-btn--pill';
    if (fullWidth) classes += ' es-btn--full';
    if (nav) classes += ' es-btn--nav';
    button.className = classes;
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  _syncModuleButtons() {
    this._moduleButtons.forEach((button, module) => {
      const isActive = module === this._activeModule;
      this._syncToggleButton(button, isActive, false);
      button.dataset.active = isActive ? 'true' : 'false';
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  _syncModuleVisibility({ immediate = false } = {}) {
    this._setModuleVisibility(this._geoModuleEl, this._activeModule === EDITOR_MODULE_GEO, immediate);
    this._setModuleVisibility(this._shaderModuleEl, this._activeModule === EDITOR_MODULE_SHADER, immediate);
  }

  _setModuleVisibility(moduleEl, isActive, immediate) {
    if (!moduleEl) {
      return;
    }

    if (immediate) {
      moduleEl.classList.add('es-module--no-transition');
      moduleEl.dataset.visible = isActive ? 'true' : 'false';
      void moduleEl.offsetHeight;
      moduleEl.classList.remove('es-module--no-transition');
      return;
    }

    moduleEl.dataset.visible = isActive ? 'true' : 'false';
  }

  _syncOutputWindowControls() {
    const { available, connected } = this._outputWindowState;
    if (connected) {
      this._outputStatusBadge.textContent = 'Output Live';
      this._outputStatusBadge.dataset.status = 'connected';
    } else if (available) {
      this._outputStatusBadge.textContent = 'Output Opening';
      this._outputStatusBadge.dataset.status = 'available';
    } else {
      this._outputStatusBadge.textContent = 'Output Offline';
      this._outputStatusBadge.dataset.status = 'offline';
    }

    this._syncButtonState(this._focusOutputBtn, available);
  }

  _syncPreviewButtons() {
    this._previewButtons.forEach((button, mode) => {
      this._syncToggleButton(button, mode === this._previewMode, false);
    });
  }

  _syncOutputModeButtons() {
    this._outputModeButtons.forEach((button, mode) => {
      this._syncToggleButton(button, mode === this._outputDisplayMode, false);
    });
  }

  _syncEditTargetButtons() {
    this._editTargetButtons.forEach((button, target) => {
      this._syncToggleButton(button, target === this._editTarget, !this._hasActiveSurface);
    });
  }

  _syncGeoStageBadges() {
    if (this._geoStagePreviewBadge) {
      this._geoStagePreviewBadge.textContent = this._previewMode === PREVIEW_MODE_EDIT
        ? 'Preview: Edit'
        : 'Preview: Output';
    }

    if (this._geoStageModeBadge) {
      this._geoStageModeBadge.textContent = this._outputDisplayMode === OUTPUT_DISPLAY_MODE_MAPPING_ASSIST
        ? 'Stage: Mapping'
        : this._outputDisplayMode === OUTPUT_DISPLAY_MODE_CALIBRATION
          ? 'Stage: Calibration'
          : 'Stage: Show';
    }
  }

  _syncShaderSummary() {
    if (!this._shaderSummaryEl) {
      return;
    }

    const outputCount = this._shaderMasterSnapshot?.outputs?.length || 0;
    const surfaceCount = this._shaderMasterSnapshot?.surfaces?.length || 0;
    const assignedCount = this._shaderMasterSnapshot?.surfaces?.filter((surface) => surface.assignedOutputId).length || 0;
    this._shaderSummaryEl.textContent = `${outputCount} output${outputCount === 1 ? '' : 's'} • ${surfaceCount} surface${surfaceCount === 1 ? '' : 's'} • ${assignedCount} assigned`;
  }

  _syncGeoSurfaceList() {
    if (!this._geoSurfaceListEl) {
      return;
    }

    const snapshot = this._shaderMasterSnapshot;
    const surfaces = snapshot?.surfaces || [];
    const nextSignature = [
      snapshot?.selectedSurfaceId || '',
      ...surfaces.map((surface) => `${surface.id}:${surface.name}:${surface.order}:${surface.assignedOutputId || ''}:${surface.visible}`),
    ].join('|');

    if (nextSignature === this._geoSurfaceListSignature) {
      return;
    }

    this._geoSurfaceListSignature = nextSignature;
    this._geoSurfaceListEl.replaceChildren();

    if (surfaces.length === 0) {
      this._geoSurfaceListEl.append(
        createText('div', 'No surfaces yet. Add one from GEO to start mapping.', 'es-surface-empty'),
      );
      return;
    }

    surfaces.forEach((surface) => {
      const isSelected = surface.id === snapshot.selectedSurfaceId;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'es-surface-row';
      row.dataset.selected = isSelected ? 'true' : 'false';
      row.addEventListener('click', () => {
        if (this.onSelectSurface) this.onSelectSurface(surface.id);
      });

      const top = document.createElement('div');
      top.className = 'es-surface-row__top';
      top.append(
        createText('div', surface.name, 'es-surface-row__name'),
        this._createBadge(surface.assignedOutputId ? 'Assigned' : 'Unassigned', Boolean(surface.assignedOutputId)),
      );

      const meta = createText('div', `Layer ${surface.order + 1} • ${surface.visible ? 'Visible' : 'Hidden'}`, 'es-surface-row__meta');

      row.append(top, meta);
      this._geoSurfaceListEl.append(row);
    });
  }

  _syncToggleButton(button, isActive, isDisabled) {
    button.disabled = isDisabled;
    button.classList.toggle('es-btn--active', isActive);
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
      this._syncButtonState(button, enabled);
    });
  }

  _syncSurfaceOrderButtons(surface, surfaceCount) {
    const hasSurface = Boolean(surface);
    const canReorder = hasSurface && surfaceCount > 1;
    const canMoveBackward = canReorder && surface.order > 0;
    const canMoveForward = canReorder && surface.order < surfaceCount - 1;

    this._syncButtonState(this._sendToBackBtn, canMoveBackward);
    this._syncButtonState(this._moveBackwardBtn, canMoveBackward);
    this._syncButtonState(this._moveForwardBtn, canMoveForward);
    this._syncButtonState(this._bringToFrontBtn, canMoveForward);
  }

  _syncButtonState(button, enabled) {
    if (!button) return;
    button.disabled = !enabled;
  }

  _describeEditTarget(target) {
    if (target === EDIT_TARGET_CONTENT) return 'content quad';
    if (target === EDIT_TARGET_SUBTRACT) return 'subtract masks';
    return 'surface quad';
  }

  dispose() {
    if (this._shell) {
      this._shell.remove();
    }
  }
}
