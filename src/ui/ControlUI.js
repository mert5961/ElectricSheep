import { ShaderMasterPanel } from '../systems/shader-master/ui/ShaderMasterPanel.ts';
import './retro-ui.css';

export class ControlUI {
  constructor(rootEl, bridge) {
    this._rootEl = rootEl;
    this._bridge = bridge;
    this._mode = 'editor';
    this._editTarget = 'surface';
    this._surfaceCount = 0;
    this._connected = false;
    this._shaderMasterState = null;
    this._shaderMasterRevision = null;

    this._statusDot = null;
    this._statusText = null;
    this._modeLabel = null;
    this._editTargetLabel = null;
    this._surfaceCountLabel = null;
    this._shaderMasterPanel = null;

    this._build();
    this._startPing();
  }

  updateState({ mode, editTarget, surfaceCount, shaderMaster }) {
    this._connected = true;
    this._mode = mode;
    this._editTarget = editTarget || this._editTarget;
    this._surfaceCount = surfaceCount;
    const nextShaderMasterRevision = shaderMaster?.revision ?? this._shaderMasterRevision;
    const shouldUpdateShaderMasterPanel = Boolean(
      shaderMaster && nextShaderMasterRevision !== this._shaderMasterRevision,
    );
    this._shaderMasterState = shaderMaster || this._shaderMasterState;
    this._shaderMasterRevision = nextShaderMasterRevision;
    this._syncDisplay();
    if (shouldUpdateShaderMasterPanel && this._shaderMasterPanel && this._shaderMasterState) {
      this._shaderMasterPanel.update(this._shaderMasterState);
    }
  }

  _syncDisplay() {
    this._statusDot.dataset.connected = this._connected ? 'true' : 'false';
    this._statusText.textContent = this._connected ? 'Output connected' : 'Output not connected';
    this._modeLabel.textContent = this._mode === 'show' ? 'Show Mode' : 'Editor Mode';
    this._modeLabel.dataset.mode = this._mode;
    this._editTargetLabel.textContent = this._editTarget === 'content'
      ? 'Content Quad'
      : this._editTarget === 'subtract'
        ? 'Subtract Quads'
        : 'Surface Quad';
    this._editTargetLabel.dataset.target = this._editTarget;
    this._surfaceCountLabel.textContent = `${this._surfaceCount} surface${this._surfaceCount !== 1 ? 's' : ''}`;
  }

  _build() {
    this._rootEl.className = 'es-control-root';

    const header = document.createElement('div');
    header.className = 'es-control-header';
    const title = document.createElement('h1');
    title.className = 'es-control-title';
    title.textContent = 'Electric Sheep';
    const subtitle = document.createElement('p');
    subtitle.className = 'es-control-subtitle';
    subtitle.textContent = 'Control Screen';
    header.append(title, subtitle);

    const statusRow = document.createElement('div');
    statusRow.className = 'es-status-row';
    this._statusDot = document.createElement('span');
    this._statusDot.className = 'es-status-dot';
    this._statusDot.dataset.connected = 'false';
    this._statusText = document.createElement('span');
    this._statusText.className = 'es-status-text';
    this._statusText.textContent = 'Output not connected';
    statusRow.append(this._statusDot, this._statusText);

    const modeSection = this._section('Mode');
    this._modeLabel = document.createElement('div');
    this._modeLabel.className = 'es-control-mode-label';
    this._modeLabel.textContent = 'Editor Mode';
    const modeButtons = document.createElement('div');
    modeButtons.className = 'es-control-btn-row';
    const editorBtn = this._btn('Editor Mode', () => {
      this._bridge.send('setMode', { mode: 'editor' });
    });
    const showBtn = this._btn('Show Mode', () => {
      this._bridge.send('setMode', { mode: 'show' });
    });
    modeButtons.append(editorBtn, showBtn);
    modeSection.append(this._modeLabel, modeButtons);

    const editTargetSection = this._section('Edit Target');
    this._editTargetLabel = document.createElement('div');
    this._editTargetLabel.className = 'es-control-target-label';
    this._editTargetLabel.textContent = 'Surface Quad';
    const editTargetButtons = document.createElement('div');
    editTargetButtons.className = 'es-control-btn-row';
    const surfaceTargetBtn = this._btn('Surface', () => {
      this._bridge.send('setEditTarget', { target: 'surface' });
    });
    const contentTargetBtn = this._btn('Content', () => {
      this._bridge.send('setEditTarget', { target: 'content' });
    });
    const subtractTargetBtn = this._btn('Subtract', () => {
      this._bridge.send('setEditTarget', { target: 'subtract' });
    });
    editTargetButtons.append(surfaceTargetBtn, contentTargetBtn, subtractTargetBtn);
    editTargetSection.append(this._editTargetLabel, editTargetButtons);

    const surfaceSection = this._section('Surfaces');
    this._surfaceCountLabel = document.createElement('div');
    this._surfaceCountLabel.className = 'es-control-count';
    this._surfaceCountLabel.textContent = '0 surfaces';
    const addSurfaceBtn = this._btn('+ Add Surface', () => {
      this._bridge.send('addSurface');
    });
    surfaceSection.append(this._surfaceCountLabel, addSurfaceBtn);

    const shaderMasterSection = this._section('Shader Master');
    this._shaderMasterPanel = new ShaderMasterPanel({
      onSelectSurface: (surfaceId) => {
        this._bridge.send('shaderCommand', {
          type: 'selectSurface',
          payload: { surfaceId },
        });
      },
      onAssignOutput: (surfaceId, outputId) => {
        this._bridge.send('shaderCommand', {
          type: 'assignOutputToSurface',
          payload: { surfaceId, outputId },
        });
      },
      onCreateOutput: (presetId) => {
        this._bridge.send('shaderCommand', {
          type: 'createOutput',
          payload: { presetId },
        });
      },
      onSelectOutput: (outputId) => {
        this._bridge.send('shaderCommand', {
          type: 'selectOutput',
          payload: { outputId },
        });
      },
      onDuplicateOutput: (outputId) => {
        this._bridge.send('shaderCommand', {
          type: 'duplicateOutput',
          payload: { outputId },
        });
      },
      onDeleteOutput: (outputId) => {
        this._bridge.send('shaderCommand', {
          type: 'deleteOutput',
          payload: { outputId },
        });
      },
      onRenameOutput: (outputId, name) => {
        this._bridge.send('shaderCommand', {
          type: 'renameOutput',
          payload: { outputId, name },
        });
      },
      onSetOutputEnabled: (outputId, enabled) => {
        this._bridge.send('shaderCommand', {
          type: 'setOutputEnabled',
          payload: { outputId, enabled },
        });
      },
      onChangeOutputPreset: (outputId, presetId) => {
        this._bridge.send('shaderCommand', {
          type: 'changeOutputPreset',
          payload: { outputId, presetId },
        });
      },
      onUpdateOutputUniform: (outputId, key, value) => {
        this._bridge.send('shaderCommand', {
          type: 'updateOutputUniform',
          payload: { outputId, key, value },
        });
      },
    });
    shaderMasterSection.append(this._shaderMasterPanel.element);

    const outputSection = this._section('Output Window');
    const openBtn = this._btn('Open Output Window', () => {
      const outputUrl = new URL('output.html', window.location.origin + import.meta.env.BASE_URL);
      window.open(outputUrl.toString(), 'electric-sheep-output', 'popup');
    });
    outputSection.append(openBtn);

    const audioSection = this._section('Audio Input');
    const audioPlaceholder = this._placeholder('Microphone analysis will appear here.');
    audioSection.append(audioPlaceholder);

    const llmSection = this._section('Master of Feelings');
    const llmPlaceholder = this._placeholder('"How do you feel?" trigger and LLM response panel will appear here.');
    llmSection.append(llmPlaceholder);

    const debugSection = this._section('Debug');
    const debugPlaceholder = this._placeholder('Response and state debug panel will appear here.');
    debugSection.append(debugPlaceholder);

    this._rootEl.append(
      header,
      statusRow,
      modeSection,
      editTargetSection,
      surfaceSection,
      shaderMasterSection,
      outputSection,
      audioSection,
      llmSection,
      debugSection,
    );
  }

  _section(title) {
    const section = document.createElement('div');
    section.className = 'es-control-section';
    const heading = document.createElement('h2');
    heading.className = 'es-control-section__heading';
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  _placeholder(text) {
    const el = document.createElement('div');
    el.className = 'es-control-placeholder';
    el.textContent = text;
    return el;
  }

  _btn(label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'es-ctrl-btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _startPing() {
    this._bridge.send('ping');

    this._pingInterval = setInterval(() => {
      this._bridge.send('ping');
    }, 2000);

    this._disconnectTimeout = null;
    this._bridge.on('state', (payload) => {
      this.updateState(payload);

      clearTimeout(this._disconnectTimeout);
      this._disconnectTimeout = setTimeout(() => {
        this._connected = false;
        this._syncDisplay();
      }, 5000);
    });
  }

  dispose() {
    clearInterval(this._pingInterval);
    clearTimeout(this._disconnectTimeout);
    this._bridge.dispose();
  }
}
