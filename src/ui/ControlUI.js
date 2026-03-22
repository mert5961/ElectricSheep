import { ShaderMasterPanel } from '../systems/shader-master/ui/ShaderMasterPanel.ts';

const RETRO_FONT = '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
const RETRO_TEXT = '#b8de9d';
const RETRO_TEXT_STRONG = '#d5f7c4';
const RETRO_MUTED = '#7fa96f';
const RETRO_BORDER = 'rgba(120, 170, 96, 0.28)';
const RETRO_PANEL = 'linear-gradient(180deg, rgba(8, 18, 8, 0.96) 0%, rgba(5, 12, 5, 0.98) 100%)';
const RETRO_PANEL_SOFT = 'rgba(8, 18, 8, 0.82)';
const RETRO_ACCENT = '#9ddf74';
const RETRO_WARNING = '#d6bd6a';
const RETRO_ALERT = '#b8a06c';

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
    this._statusDot.style.background = this._connected ? RETRO_ACCENT : RETRO_WARNING;
    this._statusDot.style.boxShadow = this._connected
      ? '0 0 10px rgba(157, 223, 116, 0.5)'
      : '0 0 10px rgba(214, 189, 106, 0.35)';
    this._statusText.textContent = this._connected ? 'Output connected' : 'Output not connected';
    this._modeLabel.textContent = this._mode === 'show' ? 'Show Mode' : 'Editor Mode';
    this._modeLabel.style.color = this._mode === 'show' ? RETRO_WARNING : RETRO_TEXT_STRONG;
    this._editTargetLabel.textContent = this._editTarget === 'content'
      ? 'Content Quad'
      : this._editTarget === 'subtract'
        ? 'Subtract Quads'
        : 'Surface Quad';
    this._editTargetLabel.style.color = this._editTarget === 'content'
      ? RETRO_WARNING
      : this._editTarget === 'subtract'
        ? RETRO_ALERT
        : RETRO_TEXT_STRONG;
    this._surfaceCountLabel.textContent = `${this._surfaceCount} surface${this._surfaceCount !== 1 ? 's' : ''}`;
  }

  _build() {
    Object.assign(this._rootEl.style, {
      padding: '24px',
      overflowY: 'auto',
      display: 'grid',
      alignContent: 'start',
      gap: '18px',
      fontFamily: RETRO_FONT,
      color: RETRO_TEXT,
      textShadow: '0 0 8px rgba(154, 255, 138, 0.12)',
    });

    // Header
    const header = this._el('div', {
      display: 'grid',
      gap: '8px',
    });
    const title = this._el('h1', {
      fontSize: '22px',
      fontWeight: '700',
      color: RETRO_TEXT_STRONG,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    });
    title.textContent = 'Electric Sheep';

    const subtitle = this._el('p', {
      fontSize: '13px',
      color: RETRO_MUTED,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    });
    subtitle.textContent = 'Control Screen';

    header.append(title, subtitle);

    // Connection status
    const statusRow = this._el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 14px',
      background: RETRO_PANEL,
      borderRadius: '2px',
      border: `1px solid ${RETRO_BORDER}`,
      boxShadow: 'inset 0 0 0 1px rgba(189,255,172,0.03), 0 0 18px rgba(74, 136, 60, 0.08)',
    });
    this._statusDot = this._el('span', {
      width: '9px',
      height: '9px',
      borderRadius: '1px',
      background: RETRO_WARNING,
      flexShrink: '0',
      boxShadow: '0 0 10px currentColor',
    });
    this._statusText = this._el('span', { fontSize: '13px', color: RETRO_MUTED });
    this._statusText.textContent = 'Output not connected';
    statusRow.append(this._statusDot, this._statusText);

    // Mode section
    const modeSection = this._section('Mode');
    this._modeLabel = this._el('div', {
      fontSize: '18px',
      fontWeight: '600',
      color: RETRO_TEXT_STRONG,
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
      color: RETRO_TEXT_STRONG,
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
      color: RETRO_MUTED,
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
      const outputUrl = new URL('output.html', window.location.origin + import.meta.env.BASE_URL);
      window.open(outputUrl.toString(), 'electric-sheep-output', 'popup');
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
      padding: '16px',
      background: RETRO_PANEL,
      borderRadius: '2px',
      border: `1px solid ${RETRO_BORDER}`,
      boxShadow: 'inset 0 0 0 1px rgba(189,255,172,0.03), 0 0 18px rgba(74, 136, 60, 0.08)',
    });
    const heading = this._el('h2', {
      fontSize: '13px',
      fontWeight: '600',
      color: RETRO_MUTED,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      marginBottom: '12px',
    });
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  _placeholder(text) {
    const el = this._el('div', {
      fontSize: '13px',
      color: RETRO_MUTED,
      fontStyle: 'italic',
      padding: '12px',
      border: `1px dashed ${RETRO_BORDER}`,
      borderRadius: '2px',
      textAlign: 'center',
      background: RETRO_PANEL_SOFT,
    });
    el.textContent = text;
    return el;
  }

  _btn(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      background: RETRO_PANEL,
      color: RETRO_TEXT,
      border: `1px solid ${RETRO_BORDER}`,
      borderRadius: '2px',
      padding: '9px 14px',
      cursor: 'pointer',
      fontSize: '12px',
      fontFamily: RETRO_FONT,
      fontWeight: '600',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      boxShadow: 'inset 0 0 0 1px rgba(189,255,172,0.03), 0 0 12px rgba(116,255,108,0.05)',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'linear-gradient(180deg, rgba(22, 42, 20, 0.98) 0%, rgba(9, 22, 9, 1) 100%)';
      btn.style.borderColor = 'rgba(166, 223, 134, 0.5)';
      btn.style.boxShadow = 'inset 0 0 0 1px rgba(189,255,172,0.08), 0 0 16px rgba(116,255,108,0.12)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = RETRO_PANEL;
      btn.style.borderColor = RETRO_BORDER;
      btn.style.boxShadow = 'inset 0 0 0 1px rgba(189,255,172,0.03), 0 0 12px rgba(116,255,108,0.05)';
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
