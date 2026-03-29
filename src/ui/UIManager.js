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
import { DraggablePanelController, resetAllPanelLayouts } from './PanelDragger.ts';
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
    this._geoSurfaceDragState = null;
    this._activeSurfaceDetails = null;
    this._surfaceSubtractExpanded = new Map();

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
    this._addSubtractBtn = null;
    this._openOutputCtaBtn = null;
    this._focusOutputBtn = null;
    this._fullscreenOutputBtn = null;
    this._resetLayoutBtn = null;
    this._topbarPreviewReadout = null;
    this._topbarModeReadout = null;
    this._geoSurfaceListEl = null;
    this._geoSurfacesRail = null;
    this._shaderSummaryEl = null;
    this._shaderMasterPanel = null;
    this._stageCanvasFrame = null;
    this._panelControllers = [];

    this.onModuleChange = null;
    this.onAddSurface = null;
    this.onFeatherChange = null;
    this.onSubtractFeatherChange = null;
    this.onEditTargetChange = null;
    this.onAddSubtractQuad = null;
    this.onRemoveSubtractQuad = null;
    this.onSelectSubtractQuad = null;
    this.onToggleSurfaceVisibility = null;
    this.onMoveSurfaceToIndex = null;
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
    this._activeSurfaceDetails = surface
      ? {
          id: surface.id,
          feather: surface.feather,
          subtractQuadCount: surface.subtractQuadCount,
          activeSubtractQuadIndex: surface.activeSubtractQuadIndex,
          activeSubtractFeather: surface.activeSubtractFeather,
          subtractQuads: surface.subtractQuads.map((subtractQuad, index) => ({
            feather: subtractQuad.feather,
            visible: subtractQuad.visible,
            index,
          })),
        }
      : null;

    if (surface) {
      if (this._surfaceLabel) {
        this._surfaceLabel.textContent = surface.name;
      }
      if (this._surfaceMetaLabel) {
        this._surfaceMetaLabel.textContent = `Editing ${this._describeEditTarget(this._editTarget)} on the shared stage`;
      }
    } else {
      if (this._surfaceLabel) {
        this._surfaceLabel.textContent = 'No surface selected';
      }
      if (this._surfaceMetaLabel) {
        this._surfaceMetaLabel.textContent = 'Add a surface or click one directly on the stage to begin mapping.';
      }
    }

    this._syncEditTargetButtons();
    this._syncSubtractButtons(surface);
    this._syncGeoSurfaceList();
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
      createText('div', 'GEO / SHADER', 'es-text-subtitle'),
    );

    const controls = document.createElement('div');
    controls.className = 'es-topbar__controls';

    const actions = document.createElement('div');
    actions.className = 'es-topbar__actions';
    this._focusOutputBtn = this._createIconButton('center_focus_strong', 'Focus', () => {
      if (this.onFocusOutputWindow) this.onFocusOutputWindow();
    });
    this._fullscreenOutputBtn = this._createIconButton('fullscreen', 'Fullscreen', () => {
      if (this.onFullscreenOutputWindow) this.onFullscreenOutputWindow();
    });
    this._resetLayoutBtn = this._createIconButton('restart_alt', 'Reset', () => {
      resetAllPanelLayouts();
    });

    actions.append(
      this._focusOutputBtn,
      this._fullscreenOutputBtn,
      this._resetLayoutBtn,
    );

    const status = document.createElement('div');
    status.className = 'es-topbar__status';
    this._topbarPreviewReadout = this._createTopbarReadout('visibility', 'VIEW: EDIT');
    this._topbarModeReadout = this._createTopbarReadout('tune', 'MODE: SHOW');
    status.append(this._topbarPreviewReadout, this._topbarModeReadout);

    controls.append(actions, status);

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
    const controlsHeader = this._createBracketHeader('MAP');
    controlsCard.append(controlsHeader);

    const addSurfaceBtn = this._createButton('Add Surface', () => {
      if (this.onAddSurface) this.onAddSurface();
    }, { active: true, fullWidth: true, className: 'es-btn--add-surface' });
    this._addSubtractBtn = this._createButton('Add Subtract', () => {
      if (this.onAddSubtractQuad) this.onAddSubtractQuad();
    }, { fullWidth: true, className: 'es-btn--minor' });

    const workspaceSection = this._createSection('View');
    const previewGroup = this._createInlineGroup('Preview');
    previewGroup.element.classList.add('es-inline-group--stage');
    previewGroup.row.classList.add('es-inline-group__row--stage');
    previewGroup.row.append(
      this._createPreviewButton('Edit', PREVIEW_MODE_EDIT),
      this._createPreviewButton('Output', PREVIEW_MODE_OUTPUT),
    );
    const outputModeGroup = this._createInlineGroup('Stage');
    outputModeGroup.element.classList.add('es-inline-group--stage');
    outputModeGroup.row.classList.add('es-inline-group__row--stage');
    outputModeGroup.row.append(
      this._createOutputModeButton('Show', OUTPUT_DISPLAY_MODE_SHOW),
      this._createOutputModeButton('Mapping', OUTPUT_DISPLAY_MODE_MAPPING_ASSIST),
      this._createOutputModeButton('Calibration', OUTPUT_DISPLAY_MODE_CALIBRATION),
    );
    workspaceSection.append(previewGroup.element, outputModeGroup.element);

    const editSection = this._createSection('Target');
    const editButtons = document.createElement('div');
    editButtons.className = 'es-stack-list';
    editButtons.append(
      this._createEditTargetButton('Surface', EDIT_TARGET_SURFACE),
      this._createEditTargetButton('Content', EDIT_TARGET_CONTENT),
      this._createEditTargetButton('Subtract', EDIT_TARGET_SUBTRACT),
    );
    editSection.append(editButtons);

    controlsCard.append(
      addSurfaceBtn,
      this._addSubtractBtn,
      workspaceSection,
      editSection,
    );

    const stageCard = this._createCard('es-card--stage');
    this._stageCanvasFrame = document.createElement('div');
    this._stageCanvasFrame.className = 'es-stage__canvas-frame';
    const stageGrid = document.createElement('div');
    stageGrid.className = 'es-stage__canvas-grid';
    this._stageCanvasFrame.append(stageGrid);

    this._openOutputCtaBtn = this._createOpenOutputCta();

    stageCard.append(this._stageCanvasFrame, this._openOutputCtaBtn);

    const surfacesCard = this._createCard('es-card--surfaces');
    const surfacesHeader = this._createBracketHeader('SURFACES');
    surfacesCard.append(surfacesHeader);
    this._geoSurfaceListEl = document.createElement('div');
    this._geoSurfaceListEl.className = 'es-surface-list';
    this._geoSurfaceListEl.addEventListener('dragover', this._handleGeoSurfaceListDragOver);
    this._geoSurfaceListEl.addEventListener('drop', this._handleGeoSurfaceListDrop);
    this._geoSurfaceListEl.addEventListener('dragleave', this._handleGeoSurfaceListDragLeave);
    surfacesCard.append(this._geoSurfaceListEl);

    const leftRail = document.createElement('div');
    leftRail.className = 'es-geo-rail es-geo-rail--left';
    leftRail.append(controlsCard);

    const stageColumn = document.createElement('div');
    stageColumn.className = 'es-geo-stage-column';
    stageColumn.append(stageCard);

    const rightRail = document.createElement('div');
    rightRail.className = 'es-geo-rail es-geo-rail--right';
    rightRail.dataset.visible = 'false';
    rightRail.append(surfacesCard);
    this._geoSurfacesRail = rightRail;

    moduleEl.append(leftRail, stageColumn, rightRail);
    this._panelControllers.push(
      new DraggablePanelController({
        id: 'geo-map-panel',
        element: leftRail,
        handle: controlsHeader,
        boundsEl: moduleEl,
        mode: 'absolute',
      }),
      new DraggablePanelController({
        id: 'geo-surfaces-panel',
        element: rightRail,
        handle: surfacesHeader,
        boundsEl: moduleEl,
        mode: 'absolute',
      }),
    );
    return moduleEl;
  }

  _buildShaderModule() {
    const moduleEl = document.createElement('div');
    moduleEl.className = 'es-module es-module--shader';

    const bodyCard = this._createCard('es-card--shader-body');
    bodyCard.append(this._createBracketHeader('SHADER'));

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
    }, { className: 'es-btn--stage-mode' });
    this._previewButtons.set(mode, button);
    return button;
  }

  _createOutputModeButton(label, mode) {
    const button = this._createButton(label, () => {
      if (this.onOutputDisplayModeChange) this.onOutputDisplayModeChange(mode);
    }, { className: 'es-btn--stage-mode' });
    this._outputModeButtons.set(mode, button);
    return button;
  }

  _createEditTargetButton(label, target) {
    const button = this._createButton(label, () => {
      if (!this._hasActiveSurface) return;
      if (this.onEditTargetChange) this.onEditTargetChange(target);
    }, { className: 'es-btn--stage-mode' });
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

  _createIconButton(icon, title, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'es-bracket-btn';
    button.title = title;
    button.setAttribute('aria-label', title);

    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-outlined es-bracket-btn__icon';
    iconEl.textContent = icon;
    button.append(iconEl);
    button.addEventListener('click', onClick);
    return button;
  }

  _createMiniIconButton(icon, title, onClick, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `es-mini-icon-btn${className ? ` ${className}` : ''}`;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', onClick);

    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-outlined es-mini-icon-btn__icon';
    iconEl.textContent = icon;
    button.append(iconEl);
    return button;
  }

  _createTopbarReadout(icon, value, flicker = false) {
    const item = document.createElement('div');
    item.className = `es-topbar__readout${flicker ? ' es-topbar__readout--flicker' : ''}`;

    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-outlined es-topbar__readout-icon';
    iconEl.textContent = icon;

    const valueEl = createText('span', value, 'es-topbar__readout-value');
    item.append(iconEl, valueEl);
    item._valueEl = valueEl;
    return item;
  }

  _createStageInfo(label, value) {
    const item = document.createElement('div');
    item.className = 'es-stage-info';

    const labelEl = createText('span', `${label}:`, 'es-stage-info__label');
    const valueEl = createText('span', value, 'es-stage-info__value');
    item.append(labelEl, valueEl);
    item._valueEl = valueEl;
    return item;
  }

  _createOpenOutputCta() {
    const wrap = document.createElement('div');
    wrap.className = 'es-stage__open-output';
    wrap.dataset.visible = 'true';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'es-open-output-cta';
    button.addEventListener('click', () => {
      if (this.onOpenOutputWindow) this.onOpenOutputWindow();
    });
    button.append(
      createText('span', '[', 'es-open-output-cta__bracket'),
      createText('span', 'OPEN', 'es-open-output-cta__label'),
      createText('span', 'OUTPUT', 'es-open-output-cta__label'),
      createText('span', ']', 'es-open-output-cta__bracket'),
    );

    wrap.append(button);
    return wrap;
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
      this._syncSliderProgress(input);
      onChange(value);
    });
    this._syncSliderProgress(input);

    header.append(title, valueLabel);
    group.append(header, input);
    return { element: group, input, valueLabel };
  }

  _createButton(label, onClick, {
    active = false,
    pill = false,
    fullWidth = false,
    nav = false,
    className = '',
  } = {}) {
    const button = document.createElement('button');
    let classes = 'es-retro-button es-btn';
    if (active) classes += ' es-btn--active';
    if (pill) classes += ' es-btn--pill';
    if (fullWidth) classes += ' es-btn--full';
    if (nav) classes += ' es-btn--nav';
    if (className) classes += ` ${className}`;
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
    this._syncButtonState(this._focusOutputBtn, available);
    this._syncButtonState(this._fullscreenOutputBtn, available);
    if (this._openOutputCtaBtn) {
      this._openOutputCtaBtn.dataset.visible = available ? 'false' : 'true';
    }
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
    if (this._topbarPreviewReadout) {
      this._topbarPreviewReadout._valueEl.textContent = this._previewMode === PREVIEW_MODE_EDIT
        ? 'VIEW: EDIT'
        : 'VIEW: OUTPUT';
    }

    if (this._topbarModeReadout) {
      this._topbarModeReadout._valueEl.textContent = this._outputDisplayMode === OUTPUT_DISPLAY_MODE_MAPPING_ASSIST
        ? 'MODE: MAP'
        : this._outputDisplayMode === OUTPUT_DISPLAY_MODE_CALIBRATION
          ? 'MODE: CAL'
          : 'MODE: SHOW';
    }
  }

  _syncShaderSummary() {
    if (!this._shaderSummaryEl) {
      return;
    }

    const outputCount = this._shaderMasterSnapshot?.outputs?.length || 0;
    const surfaceCount = this._shaderMasterSnapshot?.surfaces?.length || 0;
    const assignedCount = this._shaderMasterSnapshot?.surfaces?.filter((surface) => surface.assignedOutputId).length || 0;
    this._shaderSummaryEl.textContent = `${outputCount} out • ${surfaceCount} surf • ${assignedCount} live`;
  }

  _syncGeoSurfaceList() {
    if (!this._geoSurfaceListEl) {
      return;
    }

    const snapshot = this._shaderMasterSnapshot;
    const surfaces = snapshot?.surfaces || [];
    const displaySurfaces = this._getGeoDisplaySurfaces(surfaces);
    if (this._geoSurfacesRail) {
      this._geoSurfacesRail.dataset.visible = surfaces.length > 0 ? 'true' : 'false';
    }
    const nextSignature = [
      snapshot?.selectedSurfaceId || '',
      [...this._surfaceSubtractExpanded.entries()]
        .map(([surfaceId, expanded]) => `${surfaceId}:${expanded ? '1' : '0'}`)
        .sort()
        .join(','),
      this._activeSurfaceDetails
        ? `${this._activeSurfaceDetails.id}:${this._activeSurfaceDetails.feather}:${this._activeSurfaceDetails.activeSubtractQuadIndex}:${this._activeSurfaceDetails.activeSubtractFeather}:${this._activeSurfaceDetails.subtractQuads.map((subtractQuad) => `${subtractQuad.index}:${subtractQuad.feather}:${subtractQuad.visible}`).join(',')}`
        : '',
      ...displaySurfaces.map((surface) => `${surface.id}:${surface.name}:${surface.order}:${surface.assignedOutputId || ''}:${surface.visible}`),
    ].join('|');

    if (nextSignature === this._geoSurfaceListSignature) {
      return;
    }

    this._geoSurfaceListSignature = nextSignature;
    this._geoSurfaceListEl.replaceChildren();

    if (displaySurfaces.length === 0) {
      this._geoSurfaceListEl.append(
        createText('div', 'No surfaces yet. Add one from GEO to start mapping.', 'es-surface-empty'),
      );
      return;
    }

    displaySurfaces.forEach((surface) => {
      const isSelected = surface.id === snapshot.selectedSurfaceId;
      const row = document.createElement('div');
      row.className = 'es-surface-row';
      row.dataset.surfaceId = surface.id;
      row.dataset.selected = isSelected ? 'true' : 'false';
      row.dataset.visible = surface.visible ? 'true' : 'false';
      const canDrag = displaySurfaces.length > 1;

      const summary = document.createElement('div');
      summary.className = 'es-surface-row__summary';
      summary.tabIndex = 0;
      summary.draggable = canDrag;
      summary.addEventListener('dragstart', (event) => {
        const dragTarget = event.target instanceof HTMLElement ? event.target : null;
        if (dragTarget?.closest('.es-surface-inspector, input, select, textarea, button, a')) {
          event.preventDefault();
          return;
        }

        if (!canDrag) {
          event.preventDefault();
          return;
        }

        this._geoSurfaceDragState = {
          sourceId: surface.id,
          targetId: surface.id,
          position: 'after',
        };
        row.dataset.dragging = 'true';
        this._geoSurfaceListEl.dataset.dragging = 'true';

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', surface.id);
        }
      });
      summary.addEventListener('dragend', () => {
        this._commitGeoSurfaceDrag();
      });

      summary.addEventListener('click', () => {
        if (this.onSelectSurface) this.onSelectSurface(surface.id);
      });
      summary.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        if (this.onSelectSurface) this.onSelectSurface(surface.id);
      });

      const top = document.createElement('div');
      top.className = 'es-surface-row__top';
      top.append(createText('div', surface.name, 'es-surface-row__name'));

      const actions = document.createElement('div');
      actions.className = 'es-surface-row__actions';

      const visibilityBtn = this._createMiniIconButton(
        surface.visible ? 'visibility' : 'visibility_off',
        surface.visible ? `Hide ${surface.name}` : `Show ${surface.name}`,
        (event) => {
          event.stopPropagation();
          if (this.onToggleSurfaceVisibility) {
            this.onToggleSurfaceVisibility(surface.id, !surface.visible);
          }
        },
        'es-surface-row__action',
      );
      visibilityBtn.dataset.active = surface.visible ? 'true' : 'false';
      actions.append(visibilityBtn);

      top.append(actions);

      summary.append(top);
      row.append(summary);

      if (isSelected) {
        row.append(this._createGeoSurfaceInspector(surface));
      }

      this._geoSurfaceListEl.append(row);
    });
  }

  _createGeoSurfaceInspector(surface) {
    const inspector = document.createElement('div');
    inspector.className = 'es-surface-inspector';

    const details = this._activeSurfaceDetails?.id === surface.id
      ? this._activeSurfaceDetails
      : null;

    const surfaceSlider = this._createMiniSlider({
      label: 'Surface Feather',
      value: details?.feather ?? 0,
      max: MAX_SURFACE_FEATHER,
      disabled: !details,
      onInput: (value) => {
        if (this.onFeatherChange) this.onFeatherChange(value);
      },
    });
    inspector.append(surfaceSlider);

    const isSubtractExpanded = this._surfaceSubtractExpanded.get(surface.id) === true;
    const subtractHeader = document.createElement('div');
    subtractHeader.className = 'es-surface-inspector__header';
    const subtractTitle = document.createElement('div');
    subtractTitle.className = 'es-surface-inspector__heading';
    subtractTitle.append(
      createText('div', 'Subtract', 'es-surface-inspector__title'),
      createText(
        'div',
        details?.subtractQuadCount ? `${details.subtractQuadCount}` : '0',
        'es-surface-inspector__count',
      ),
    );

    const subtractToggle = this._createMiniIconButton(
      isSubtractExpanded ? 'expand_less' : 'expand_more',
      isSubtractExpanded ? 'Collapse subtracts' : 'Expand subtracts',
      (event) => {
        event.stopPropagation();
        this._surfaceSubtractExpanded.set(surface.id, !isSubtractExpanded);
        this._geoSurfaceListSignature = '';
        this._syncGeoSurfaceList();
      },
      'es-surface-inspector__toggle',
    );
    subtractToggle.dataset.expanded = isSubtractExpanded ? 'true' : 'false';
    subtractHeader.append(
      subtractTitle,
      subtractToggle,
    );
    inspector.append(subtractHeader);

    if (!isSubtractExpanded) {
      return inspector;
    }

    const subtractList = document.createElement('div');
    subtractList.className = 'es-subtract-list';

    if (!details || details.subtractQuads.length === 0) {
      subtractList.append(createText('div', 'No subtract quads', 'es-subtract-empty'));
    } else {
      details.subtractQuads.forEach((subtractQuad) => {
        const isActive = subtractQuad.index === details.activeSubtractQuadIndex;
        const item = document.createElement('div');
        item.className = 'es-subtract-item';
        item.dataset.active = isActive ? 'true' : 'false';

        const itemButton = document.createElement('button');
        itemButton.type = 'button';
        itemButton.className = 'es-subtract-item__button';
        itemButton.addEventListener('click', () => {
          if (this.onSelectSubtractQuad) this.onSelectSubtractQuad(subtractQuad.index);
        });
        itemButton.append(createText('span', `Subtract ${subtractQuad.index + 1}`, 'es-subtract-item__label'));

        if (isActive) {
          const removeBtn = this._createButton('Remove', (event) => {
            event?.stopPropagation?.();
            if (this.onRemoveSubtractQuad) this.onRemoveSubtractQuad();
          }, { className: 'es-btn--minor es-btn--tight' });
          removeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
          });
          itemButton.append(removeBtn);
        }
        item.append(itemButton);

        if (isActive) {
          item.append(this._createMiniSlider({
            label: 'Subtract Feather',
            value: details.activeSubtractFeather,
            max: MAX_SUBTRACT_FEATHER,
            onInput: (value) => {
              if (this.onSubtractFeatherChange) this.onSubtractFeatherChange(value);
            },
          }));
        }

        subtractList.append(item);
      });
    }

    inspector.append(subtractList);
    return inspector;
  }

  _createMiniSlider({
    label,
    value,
    max,
    disabled = false,
    onInput,
  }) {
    const group = document.createElement('div');
    group.className = 'es-slider es-slider--compact';

    const header = document.createElement('div');
    header.className = 'es-slider__header';
    header.append(
      createText('div', label, 'es-slider__title'),
      createText('div', Number.parseFloat(value || 0).toFixed(2), 'es-slider__value'),
    );

    const valueLabel = header.lastChild;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(max);
    input.step = '0.005';
    input.value = String(value ?? 0);
    input.disabled = disabled;
    input.className = 'es-slider__input';
    input.addEventListener('input', (event) => {
      const nextValue = Number.parseFloat(event.target.value);
      valueLabel.textContent = nextValue.toFixed(2);
      this._syncSliderProgress(input);
      onInput(nextValue);
    });
    this._syncSliderProgress(input);

    group.append(header, input);
    return group;
  }

  _syncToggleButton(button, isActive, isDisabled) {
    button.disabled = isDisabled;
    button.classList.toggle('es-btn--active', isActive);
  }

  _syncSubtractButtons(surface) {
    const hasSurface = Boolean(surface);
    const subtractCount = surface ? surface.subtractQuadCount : 0;
    const canAddSubtract = hasSurface && subtractCount < (surface?.subtractQuadLimit ?? 0);
    this._syncButtonState(this._addSubtractBtn, canAddSubtract);
  }

  _syncButtonState(button, enabled) {
    if (!button) return;
    button.disabled = !enabled;
  }

  _syncSliderProgress(input) {
    if (!input) {
      return;
    }

    const min = Number.parseFloat(input.min || '0');
    const max = Number.parseFloat(input.max || '1');
    const value = Number.parseFloat(input.value || '0');
    const range = max - min;
    const progress = range <= 0 ? 0 : ((value - min) / range) * 100;
    input.style.setProperty('--es-slider-progress', `${Math.max(0, Math.min(100, progress))}%`);
  }

  _handleGeoSurfaceListDragOver = (event) => {
    if (!this._geoSurfaceDragState || !this._geoSurfaceListEl) {
      return;
    }

    event.preventDefault();
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest('.es-surface-row');
    if (row && row.dataset.surfaceId) {
      const rect = row.getBoundingClientRect();
      const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      this._setGeoSurfaceDropTarget(row.dataset.surfaceId, position);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      return;
    }

    const rows = Array.from(this._geoSurfaceListEl.querySelectorAll('.es-surface-row'));
    const lastRow = rows.at(-1);
    if (lastRow?.dataset.surfaceId) {
      this._setGeoSurfaceDropTarget(lastRow.dataset.surfaceId, 'after');
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }
  };

  _handleGeoSurfaceListDrop = (event) => {
    if (!this._geoSurfaceDragState) {
      return;
    }

    event.preventDefault();
    this._commitGeoSurfaceDrag();
  };

  _commitGeoSurfaceDrag() {
    if (!this._geoSurfaceDragState) {
      return;
    }

    const { sourceId, targetId, position } = this._geoSurfaceDragState;
    const displaySurfaces = this._getGeoDisplaySurfaces(this._shaderMasterSnapshot?.surfaces || []);
    const currentIndex = displaySurfaces.findIndex((surface) => surface.id === sourceId);
    const targetIndex = displaySurfaces.findIndex((surface) => surface.id === targetId);
    if (currentIndex < 0 || targetIndex < 0) {
      this._clearGeoSurfaceDragState();
      return;
    }

    let nextIndex = targetIndex;
    if (position === 'before') {
      nextIndex = targetIndex - (currentIndex < targetIndex ? 1 : 0);
    } else {
      nextIndex = targetIndex + (currentIndex > targetIndex ? 1 : 0);
    }

    const actualIndex = Math.max(0, Math.min(displaySurfaces.length - 1, (displaySurfaces.length - 1) - nextIndex));
    if (sourceId !== targetId && this.onMoveSurfaceToIndex) {
      this.onMoveSurfaceToIndex(sourceId, actualIndex);
    }

    this._clearGeoSurfaceDragState();
  }

  _handleGeoSurfaceListDragLeave = (event) => {
    if (!this._geoSurfaceListEl) {
      return;
    }

    const nextTarget = event.relatedTarget;
    if (nextTarget && this._geoSurfaceListEl.contains(nextTarget)) {
      return;
    }

    this._clearGeoSurfaceDropTarget();
  };

  _setGeoSurfaceDropTarget(targetId, position) {
    if (!this._geoSurfaceDragState || !this._geoSurfaceListEl) {
      return;
    }

    this._geoSurfaceDragState.targetId = targetId;
    this._geoSurfaceDragState.position = position;

    Array.from(this._geoSurfaceListEl.querySelectorAll('.es-surface-row')).forEach((row) => {
      row.dataset.dropPosition = row.dataset.surfaceId === targetId ? position : '';
    });
  }

  _clearGeoSurfaceDropTarget() {
    if (!this._geoSurfaceListEl) {
      return;
    }

    Array.from(this._geoSurfaceListEl.querySelectorAll('.es-surface-row')).forEach((row) => {
      delete row.dataset.dropPosition;
    });
  }

  _clearGeoSurfaceDragState() {
    if (this._geoSurfaceListEl) {
      delete this._geoSurfaceListEl.dataset.dragging;
      Array.from(this._geoSurfaceListEl.querySelectorAll('.es-surface-row')).forEach((row) => {
        delete row.dataset.dragging;
        delete row.dataset.dropPosition;
      });
    }

    this._geoSurfaceDragState = null;
  }

  _getGeoDisplaySurfaces(surfaces) {
    return [...surfaces].sort((left, right) => {
      if (left.order !== right.order) {
        return right.order - left.order;
      }

      return left.id.localeCompare(right.id);
    });
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
