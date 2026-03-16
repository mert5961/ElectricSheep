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

function createText(tagName, text, style = {}) {
  const element = document.createElement(tagName);
  element.textContent = text;
  Object.assign(element.style, style);
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
      this._surfaceLabel.textContent = surface.name;
      this._surfaceMetaLabel.textContent = `Editing ${this._describeEditTarget(this._editTarget)} on the shared stage`;
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
      this._surfaceLabel.textContent = 'No surface selected';
      this._surfaceMetaLabel.textContent = 'Add a surface or click one directly on the stage to begin mapping.';
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
    Object.assign(this._shell.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      padding: '18px',
      pointerEvents: 'none',
    });

    this._topbar = this._buildTopbar();
    this._content = document.createElement('div');
    Object.assign(this._content.style, {
      position: 'relative',
      flex: '1',
      minHeight: '0',
    });

    this._geoModuleEl = this._buildGeoModule();
    this._shaderModuleEl = this._buildShaderModule();

    this._content.append(this._geoModuleEl, this._shaderModuleEl);
    this._shell.append(this._topbar, this._content);
    this._uiEl.append(this._shell);

    this._syncModuleButtons();
    this._syncModuleVisibility();
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
    Object.assign(bar.style, {
      display: 'grid',
      gridTemplateColumns: 'minmax(220px, auto) minmax(220px, auto) minmax(0, 1fr)',
      alignItems: 'center',
      gap: '18px',
      padding: '14px 18px',
      borderRadius: '22px',
      background: 'linear-gradient(180deg, rgba(9,12,17,0.92) 0%, rgba(10,14,20,0.84) 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 24px 70px rgba(0, 0, 0, 0.35)',
      backdropFilter: 'blur(16px)',
      pointerEvents: 'auto',
    });

    const identity = document.createElement('div');
    Object.assign(identity.style, {
      display: 'grid',
      gap: '4px',
    });
    identity.append(
      createText('div', 'Electric Sheep', {
        color: '#eef3fb',
        fontSize: '18px',
        fontWeight: '700',
        letterSpacing: '0.01em',
      }),
      createText('div', 'AI-driven projection mapping and visual orchestration', {
        color: '#7f8fa4',
        fontSize: '12px',
        lineHeight: '1.4',
      }),
    );

    const tabs = document.createElement('div');
    Object.assign(tabs.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      justifySelf: 'start',
    });
    tabs.append(
      this._createModuleButton('GEO', EDITOR_MODULE_GEO),
      this._createModuleButton('SHADER', EDITOR_MODULE_SHADER),
    );

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '10px',
      minWidth: '0',
    });

    this._outputStatusBadge = this._createBadge('Output Offline');
    this._openOutputBtn = this._createButton('Open Output', () => {
      if (this.onOpenOutputWindow) this.onOpenOutputWindow();
    }, {
      accent: '#e7b053',
      active: true,
    });
    this._focusOutputBtn = this._createButton('Focus Output', () => {
      if (this.onFocusOutputWindow) this.onFocusOutputWindow();
    });
    this._fullscreenOutputBtn = this._createButton('Fullscreen Output', () => {
      if (this.onFullscreenOutputWindow) this.onFullscreenOutputWindow();
    }, {
      accent: '#66d4ff',
    });

    controls.append(
      this._outputStatusBadge,
      this._openOutputBtn,
      this._focusOutputBtn,
      this._fullscreenOutputBtn,
    );

    bar.append(identity, tabs, controls);
    return bar;
  }

  _buildGeoModule() {
    const moduleEl = document.createElement('div');
    Object.assign(moduleEl.style, {
      position: 'absolute',
      inset: '0',
      display: 'grid',
      gridTemplateColumns: '320px minmax(0, 1fr) 290px',
      gap: '18px',
      minHeight: '0',
    });

    const controlsCard = this._createCard({
      display: 'grid',
      gridTemplateRows: 'auto auto auto auto auto 1fr',
      gap: '14px',
      padding: '18px',
      pointerEvents: 'auto',
      overflow: 'hidden',
    });

    const geoHeader = document.createElement('div');
    Object.assign(geoHeader.style, {
      display: 'grid',
      gap: '6px',
    });
    geoHeader.append(
      createText('div', 'GEO Workspace', {
        color: '#eef3fb',
        fontSize: '18px',
        fontWeight: '700',
      }),
      createText('div', 'Projection geometry, surface editing, feathering, and layer order live here.', {
        color: '#8a99ad',
        fontSize: '12px',
        lineHeight: '1.5',
      }),
    );

    const selectionSection = this._createSection('Surface');
    this._surfaceLabel = createText('div', 'No surface selected', {
      color: '#eef3fb',
      fontSize: '16px',
      fontWeight: '600',
    });
    this._surfaceMetaLabel = createText('div', 'Add a surface or click one directly on the stage to begin mapping.', {
      color: '#8a99ad',
      fontSize: '12px',
      lineHeight: '1.5',
    });
    const addSurfaceBtn = this._createButton('+ Add Surface', () => {
      if (this.onAddSurface) this.onAddSurface();
    }, {
      accent: '#9ad18b',
      active: true,
      fullWidth: true,
    });
    selectionSection.append(this._surfaceLabel, this._surfaceMetaLabel, addSurfaceBtn);

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
    Object.assign(editButtons.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '8px',
    });
    editButtons.append(
      this._createEditTargetButton('Surface', EDIT_TARGET_SURFACE),
      this._createEditTargetButton('Content', EDIT_TARGET_CONTENT),
      this._createEditTargetButton('Subtract', EDIT_TARGET_SUBTRACT),
    );
    editSection.append(editButtons);

    const layerSection = this._createSection('Layer Order');
    this._surfaceOrderLabel = this._createBadge('No layer');
    const orderButtons = document.createElement('div');
    Object.assign(orderButtons.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '8px',
    });
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
    const surfaceFeatherGroup = this._createSliderGroup('Surface Feather', '#66d4ff', MAX_SURFACE_FEATHER, (value) => {
      if (this.onFeatherChange) this.onFeatherChange(value);
    });
    this._featherSlider = surfaceFeatherGroup.input;
    this._featherLabel = surfaceFeatherGroup.valueLabel;
    featherSection.append(surfaceFeatherGroup.element);

    this._subtractLabel = this._createBadge('No subtract quads');
    const subtractActions = document.createElement('div');
    Object.assign(subtractActions.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '8px',
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
    subtractActions.append(
      this._addSubtractBtn,
      this._removeSubtractBtn,
      this._prevSubtractBtn,
      this._nextSubtractBtn,
    );
    const subtractFeatherGroup = this._createSliderGroup('Subtract Feather', '#ff6f61', MAX_SUBTRACT_FEATHER, (value) => {
      if (this.onSubtractFeatherChange) this.onSubtractFeatherChange(value);
    });
    this._subtractFeatherSlider = subtractFeatherGroup.input;
    this._subtractFeatherLabel = subtractFeatherGroup.valueLabel;
    featherSection.append(this._subtractLabel, subtractActions, subtractFeatherGroup.element);

    const helpSection = this._createSection('Stage Notes');
    helpSection.append(
      createText('div', 'Drag the visible handles directly on the stage. GEO keeps the spatial layout while SHADER handles preset logic and uniforms.', {
        color: '#8a99ad',
        fontSize: '12px',
        lineHeight: '1.6',
      }),
    );

    controlsCard.append(
      geoHeader,
      selectionSection,
      workspaceSection,
      editSection,
      layerSection,
      featherSection,
      helpSection,
    );

    const stageCard = this._createCard({
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      gap: '18px',
      padding: '22px',
      overflow: 'hidden',
      pointerEvents: 'none',
      background: 'linear-gradient(180deg, rgba(9,12,16,0.38) 0%, rgba(7,10,14,0.18) 100%)',
    });
    const stageTop = document.createElement('div');
    Object.assign(stageTop.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
    });
    const stageCopy = document.createElement('div');
    Object.assign(stageCopy.style, {
      display: 'grid',
      gap: '8px',
      maxWidth: '520px',
    });
    stageCopy.append(
      createText('div', 'GEO', {
        color: '#eef3fb',
        fontSize: '28px',
        fontWeight: '700',
        letterSpacing: '0.02em',
      }),
      createText('div', 'This workspace stays centered on spatial editing. Use the stage itself for handles, while the side panels keep mapping controls organized.', {
        color: '#9aa8bb',
        fontSize: '13px',
        lineHeight: '1.65',
      }),
    );
    const stageBadges = document.createElement('div');
    Object.assign(stageBadges.style, {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: '8px',
    });
    this._geoStagePreviewBadge = this._createBadge('Preview: Edit');
    this._geoStageModeBadge = this._createBadge('Stage: Show');
    stageBadges.append(this._geoStagePreviewBadge, this._geoStageModeBadge);
    stageTop.append(stageCopy, stageBadges);

    const stageCanvasFrame = document.createElement('div');
    Object.assign(stageCanvasFrame.style, {
      position: 'relative',
      minHeight: '0',
      borderRadius: '28px',
      border: '1px dashed rgba(255,255,255,0.08)',
      background: [
        'linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
      ].join(','),
      backgroundSize: '72px 72px',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
    });

    const stageFooter = createText('div', 'The projector output window remains separate. This main window is the operator console for GEO and SHADER.', {
      color: '#748195',
      fontSize: '12px',
      lineHeight: '1.6',
    });

    stageCard.append(stageTop, stageCanvasFrame, stageFooter);

    const surfacesCard = this._createCard({
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
      gap: '14px',
      padding: '18px',
      pointerEvents: 'auto',
      overflow: 'hidden',
    });
    surfacesCard.append(
      createText('div', 'Surface Navigator', {
        color: '#eef3fb',
        fontSize: '16px',
        fontWeight: '700',
      }),
    );
    this._geoSurfaceListEl = document.createElement('div');
    Object.assign(this._geoSurfaceListEl.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      overflowY: 'auto',
      minHeight: '0',
      paddingRight: '4px',
    });
    surfacesCard.append(this._geoSurfaceListEl);

    moduleEl.append(controlsCard, stageCard, surfacesCard);
    return moduleEl;
  }

  _buildShaderModule() {
    const moduleEl = document.createElement('div');
    Object.assign(moduleEl.style, {
      position: 'absolute',
      inset: '0',
      display: 'none',
      gridTemplateRows: 'auto 1fr',
      gap: '18px',
      minHeight: '0',
    });

    const headerCard = this._createCard({
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '16px',
      alignItems: 'center',
      padding: '18px 20px',
      pointerEvents: 'auto',
    });
    const copy = document.createElement('div');
    Object.assign(copy.style, {
      display: 'grid',
      gap: '6px',
    });
    copy.append(
      createText('div', 'SHADER Workspace', {
        color: '#eef3fb',
        fontSize: '20px',
        fontWeight: '700',
      }),
      createText('div', 'Outputs, presets, assignments, and uniforms live here. GEO keeps the stage geometry independent.', {
        color: '#8a99ad',
        fontSize: '13px',
        lineHeight: '1.6',
      }),
    );
    this._shaderSummaryEl = createText('div', '0 outputs • 0 surfaces', {
      color: '#d7deea',
      fontSize: '13px',
      fontWeight: '600',
      padding: '10px 14px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      whiteSpace: 'nowrap',
    });
    headerCard.append(copy, this._shaderSummaryEl);

    const bodyCard = this._createCard({
      display: 'grid',
      minHeight: '0',
      overflow: 'hidden',
      padding: '18px',
      pointerEvents: 'auto',
    });
    const panelWrap = document.createElement('div');
    Object.assign(panelWrap.style, {
      minHeight: '0',
      overflow: 'auto',
      paddingRight: '4px',
    });

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

    moduleEl.append(headerCard, bodyCard);
    return moduleEl;
  }

  _createModuleButton(label, module) {
    const button = this._createButton(label, () => {
      if (this.onModuleChange) {
        this.onModuleChange(module);
      }
    }, {
      accent: module === EDITOR_MODULE_GEO ? '#66d4ff' : '#f2a756',
      pill: true,
    });
    this._moduleButtons.set(module, button);
    return button;
  }

  _createPreviewButton(label, mode) {
    const button = this._createButton(label, () => {
      if (this.onPreviewModeChange) this.onPreviewModeChange(mode);
    }, {
      accent: '#9ad18b',
    });
    this._previewButtons.set(mode, button);
    return button;
  }

  _createOutputModeButton(label, mode) {
    const button = this._createButton(label, () => {
      if (this.onOutputDisplayModeChange) this.onOutputDisplayModeChange(mode);
    }, {
      accent: '#f2a756',
    });
    this._outputModeButtons.set(mode, button);
    return button;
  }

  _createEditTargetButton(label, target) {
    const accent = target === EDIT_TARGET_SURFACE
      ? '#66d4ff'
      : target === EDIT_TARGET_CONTENT
        ? '#ffb454'
        : '#ff6f61';

    const button = this._createButton(label, () => {
      if (!this._hasActiveSurface) return;
      if (this.onEditTargetChange) this.onEditTargetChange(target);
    }, {
      accent,
    });
    this._editTargetButtons.set(target, button);
    return button;
  }

  _createSection(label) {
    const section = document.createElement('div');
    Object.assign(section.style, {
      display: 'grid',
      gap: '10px',
      padding: '14px',
      borderRadius: '18px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    });
    section.append(
      createText('div', label, {
        color: '#6f7f93',
        fontSize: '11px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }),
    );
    return section;
  }

  _createInlineGroup(label) {
    const group = document.createElement('div');
    Object.assign(group.style, {
      display: 'grid',
      gap: '8px',
    });
    group.append(
      createText('div', label, {
        color: '#aeb9c8',
        fontSize: '12px',
        fontWeight: '600',
      }),
    );
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    });
    group.append(row);
    return { element: group, row };
  }

  _createCard(style = {}) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      borderRadius: '28px',
      background: 'linear-gradient(180deg, rgba(10,13,18,0.88) 0%, rgba(8,10,14,0.76) 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.32)',
      backdropFilter: 'blur(16px)',
      minHeight: '0',
    }, style);
    return card;
  }

  _createBadge(text, accent = null) {
    const badge = createText('div', text, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '999px',
      background: accent ? `${accent}20` : 'rgba(255,255,255,0.05)',
      border: accent ? `1px solid ${accent}55` : '1px solid rgba(255,255,255,0.1)',
      color: accent || '#d7deea',
      fontSize: '12px',
      fontWeight: '600',
      whiteSpace: 'nowrap',
    });
    return badge;
  }

  _createSliderGroup(label, accentColor, maxValue, onChange) {
    const group = document.createElement('div');
    Object.assign(group.style, {
      display: 'grid',
      gap: '8px',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px',
    });

    const title = createText('div', label, {
      color: '#d7deea',
      fontSize: '13px',
      fontWeight: '600',
    });

    const valueLabel = createText('div', '0.00', {
      color: '#d7deea',
      fontSize: '12px',
      fontVariantNumeric: 'tabular-nums',
    });

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(maxValue);
    input.step = '0.005';
    input.value = '0';
    input.disabled = true;
    Object.assign(input.style, {
      width: '100%',
      accentColor,
    });
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
    accent = null,
    active = false,
    pill = false,
    fullWidth = false,
  } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.accent = accent || '';
    Object.assign(button.style, {
      display: fullWidth ? 'flex' : 'inline-flex',
      width: fullWidth ? '100%' : 'auto',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      padding: pill ? '11px 16px' : '10px 14px',
      borderRadius: pill ? '999px' : '12px',
      border: active && accent ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.12)',
      background: active && accent ? `${accent}24` : 'rgba(255,255,255,0.06)',
      color: active && accent ? accent : '#e3e9f3',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'background 0.18s, border-color 0.18s, opacity 0.18s, color 0.18s',
    });
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.background = accent ? `${accent}2a` : 'rgba(255,255,255,0.12)';
      }
    });
    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        button.style.background = active && accent ? `${accent}24` : 'rgba(255,255,255,0.06)';
      }
    });
    button.addEventListener('click', onClick);
    return button;
  }

  _syncModuleButtons() {
    this._moduleButtons.forEach((button, module) => {
      const accent = module === EDITOR_MODULE_GEO ? '#66d4ff' : '#f2a756';
      this._syncToggleButton(button, module === this._activeModule, false, accent);
    });
  }

  _syncModuleVisibility() {
    this._geoModuleEl.style.display = this._activeModule === EDITOR_MODULE_GEO ? 'grid' : 'none';
    this._shaderModuleEl.style.display = this._activeModule === EDITOR_MODULE_SHADER ? 'grid' : 'none';
  }

  _syncOutputWindowControls() {
    const { available, connected } = this._outputWindowState;
    if (connected) {
      this._outputStatusBadge.textContent = 'Output Live';
      this._outputStatusBadge.style.background = 'rgba(112, 196, 135, 0.18)';
      this._outputStatusBadge.style.borderColor = 'rgba(112, 196, 135, 0.4)';
      this._outputStatusBadge.style.color = '#bff0cd';
    } else if (available) {
      this._outputStatusBadge.textContent = 'Output Opening';
      this._outputStatusBadge.style.background = 'rgba(231, 176, 83, 0.18)';
      this._outputStatusBadge.style.borderColor = 'rgba(231, 176, 83, 0.38)';
      this._outputStatusBadge.style.color = '#ffe0ad';
    } else {
      this._outputStatusBadge.textContent = 'Output Offline';
      this._outputStatusBadge.style.background = 'rgba(255,255,255,0.05)';
      this._outputStatusBadge.style.borderColor = 'rgba(255,255,255,0.1)';
      this._outputStatusBadge.style.color = '#d7deea';
    }

    this._syncButtonState(this._focusOutputBtn, available);
  }

  _syncPreviewButtons() {
    this._previewButtons.forEach((button, mode) => {
      this._syncToggleButton(button, mode === this._previewMode, false, '#9ad18b');
    });
  }

  _syncOutputModeButtons() {
    this._outputModeButtons.forEach((button, mode) => {
      this._syncToggleButton(button, mode === this._outputDisplayMode, false, '#f2a756');
    });
  }

  _syncEditTargetButtons() {
    this._editTargetButtons.forEach((button, target) => {
      const accent = target === EDIT_TARGET_SURFACE
        ? '#66d4ff'
        : target === EDIT_TARGET_CONTENT
          ? '#ffb454'
          : '#ff6f61';
      this._syncToggleButton(button, target === this._editTarget, !this._hasActiveSurface, accent);
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
        createText('div', 'No surfaces yet. Add one from GEO to start mapping.', {
          padding: '16px',
          borderRadius: '16px',
          border: '1px dashed rgba(255,255,255,0.1)',
          color: '#7f8fa4',
          fontSize: '13px',
          lineHeight: '1.6',
          textAlign: 'center',
        }),
      );
      return;
    }

    surfaces.forEach((surface) => {
      const isSelected = surface.id === snapshot.selectedSurfaceId;
      const row = document.createElement('button');
      row.type = 'button';
      Object.assign(row.style, {
        display: 'grid',
        gap: '8px',
        width: '100%',
        padding: '14px',
        borderRadius: '16px',
        border: isSelected ? '1px solid rgba(102, 212, 255, 0.38)' : '1px solid rgba(255,255,255,0.08)',
        background: isSelected ? 'rgba(26, 86, 118, 0.22)' : 'rgba(255,255,255,0.03)',
        color: '#eef3fb',
        cursor: 'pointer',
        textAlign: 'left',
      });
      row.addEventListener('click', () => {
        if (this.onSelectSurface) this.onSelectSurface(surface.id);
      });

      const top = document.createElement('div');
      Object.assign(top.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
      });
      top.append(
        createText('div', surface.name, {
          fontSize: '14px',
          fontWeight: '600',
          color: '#eef3fb',
        }),
        this._createBadge(surface.assignedOutputId ? 'Assigned' : 'Unassigned', surface.assignedOutputId ? '#9ad18b' : null),
      );

      const meta = createText('div', `Layer ${surface.order + 1} • ${surface.visible ? 'Visible' : 'Hidden'}`, {
        fontSize: '12px',
        color: '#7f8fa4',
      });

      row.append(top, meta);
      this._geoSurfaceListEl.append(row);
    });
  }

  _syncToggleButton(button, isActive, isDisabled, accent) {
    button.disabled = isDisabled;
    button.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
    button.style.opacity = isDisabled ? '0.42' : '1';
    button.style.background = isActive ? `${accent}24` : (isDisabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)');
    button.style.borderColor = isActive ? `${accent}6a` : 'rgba(255,255,255,0.12)';
    button.style.color = isActive ? accent : '#e3e9f3';
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
    button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    button.style.opacity = enabled ? '1' : '0.42';
    button.style.background = enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)';
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
