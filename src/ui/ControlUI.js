import { ShaderMasterPanel } from '../systems/shader-master/ui/ShaderMasterPanel.ts';

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
    this._statusDot.style.background = this._connected ? '#4f4' : '#f44';
    this._statusText.textContent = this._connected ? 'Output connected' : 'Output not connected';
    this._modeLabel.textContent = this._mode === 'show' ? 'Show Mode' : 'Editor Mode';
    this._modeLabel.style.color = this._mode === 'show' ? '#f90' : '#6f6';
    this._editTargetLabel.textContent = this._editTarget === 'content'
      ? 'Content Quad'
      : this._editTarget === 'subtract'
        ? 'Subtract Quads'
        : 'Surface Quad';
    this._editTargetLabel.style.color = this._editTarget === 'content'
      ? '#ffb454'
      : this._editTarget === 'subtract'
        ? '#ff6f61'
        : '#66d4ff';
    this._surfaceCountLabel.textContent = `${this._surfaceCount} surface${this._surfaceCount !== 1 ? 's' : ''}`;
  }

  _build() {
    // Header
    const header = this._el('div', {
      marginBottom: '32px',
    });
    const title = this._el('h1', {
      fontSize: '22px',
      fontWeight: '600',
      color: '#eee',
      marginBottom: '8px',
    });
    title.textContent = 'Electric Sheep';

    const subtitle = this._el('p', {
      fontSize: '13px',
      color: '#666',
    });
    subtitle.textContent = 'Control Screen';

    header.append(title, subtitle);

    // Connection status
    const statusRow = this._el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '24px',
      padding: '10px 14px',
      background: '#1a1a1a',
      borderRadius: '8px',
    });
    this._statusDot = this._el('span', {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#f44',
      flexShrink: '0',
    });
    this._statusText = this._el('span', { fontSize: '13px', color: '#888' });
    this._statusText.textContent = 'Output not connected';
    statusRow.append(this._statusDot, this._statusText);

    // Mode section
    const modeSection = this._section('Mode');
    this._modeLabel = this._el('div', {
      fontSize: '18px',
      fontWeight: '600',
      color: '#6f6',
      marginBottom: '12px',
    });
    this._modeLabel.textContent = 'Editor Mode';

    const modeButtons = this._el('div', { display: 'flex', gap: '8px' });
    const editorBtn = this._btn('Editor Mode', () => {
      this._bridge.send('setMode', { mode: 'editor' });
    });
    const showBtn = this._btn('Show Mode', () => {
      this._bridge.send('setMode', { mode: 'show' });
    });
    modeButtons.append(editorBtn, showBtn);
    modeSection.append(this._modeLabel, modeButtons);

    // Edit target section
    const editTargetSection = this._section('Edit Target');
    this._editTargetLabel = this._el('div', {
      fontSize: '18px',
      fontWeight: '600',
      color: '#66d4ff',
      marginBottom: '12px',
    });
    this._editTargetLabel.textContent = 'Surface Quad';

    const editTargetButtons = this._el('div', { display: 'flex', gap: '8px' });
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

    // Surfaces section
    const surfaceSection = this._section('Surfaces');
    this._surfaceCountLabel = this._el('div', {
      fontSize: '14px',
      color: '#aaa',
      marginBottom: '12px',
    });
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

    // Output window section
    const outputSection = this._section('Output Window');
    const openBtn = this._btn('Open Output Window', () => {
      window.open('/output.html', 'electric-sheep-output', 'popup');
    });
    outputSection.append(openBtn);

    // Future placeholder sections
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
    const section = this._el('div', {
      marginBottom: '24px',
      padding: '16px',
      background: '#1a1a1a',
      borderRadius: '8px',
      border: '1px solid #222',
    });
    const heading = this._el('h2', {
      fontSize: '13px',
      fontWeight: '600',
      color: '#555',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '12px',
    });
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  _placeholder(text) {
    const el = this._el('div', {
      fontSize: '13px',
      color: '#444',
      fontStyle: 'italic',
      padding: '12px',
      border: '1px dashed #333',
      borderRadius: '6px',
      textAlign: 'center',
    });
    el.textContent = text;
    return el;
  }

  _btn(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      background: 'rgba(255,255,255,0.08)',
      color: '#ccc',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '6px',
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: '13px',
      transition: 'background 0.15s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,255,255,0.15)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.08)';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  _el(tag, styles = {}) {
    const el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
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
