import { AUDIO_UNIFORM_SCHEMA, FEELING_UNIFORM_SCHEMA } from '../contracts/uniforms.ts';
import type { ShaderMasterSnapshot } from '../contracts/types.ts';
import type { AudioAnalyzerState } from '../../audio-analyzer/audioAnalyzerStore.ts';
import { createElement, setButtonEnabled } from './dom.ts';

interface MeterController {
  valueEl: HTMLSpanElement;
  fillEl: HTMLDivElement;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function formatAIUpdateTimestamp(timestampMs: number | null): string {
  if (timestampMs === null) {
    return 'Awaiting sync';
  }

  const secondsAgo = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  return `${new Date(timestampMs).toLocaleTimeString()} • ${secondsAgo}s ago`;
}

function setTransportButtonState(button: HTMLButtonElement, active: boolean): void {
  button.dataset.active = active ? 'true' : 'false';
}

function formatSurfaceChipLabel(name: string, index: number): string {
  const numericMatch = name.match(/\d+/);
  if (numericMatch) {
    return `S${numericMatch[0]}`;
  }

  return `S${index + 1}`;
}

function resolveLiveState(audioInputState: AudioAnalyzerState | null): {
  label: string;
  status: 'idle' | 'live' | 'wait' | 'error';
} {
  if (!audioInputState) {
    return { label: 'IDLE', status: 'idle' };
  }

  if (audioInputState.status === 'requesting') {
    return { label: 'WAIT', status: 'wait' };
  }

  if (audioInputState.status === 'error') {
    return { label: 'ERROR', status: 'error' };
  }

  if (audioInputState.status === 'running') {
    return { label: 'LIVE', status: 'live' };
  }

  return { label: 'IDLE', status: 'idle' };
}

export class OperatorMonitorPanel {
  readonly element: HTMLDivElement;

  readonly commandDeckElement: HTMLDivElement;

  readonly signalMonitorElement: HTMLDivElement;

  private readonly hasStandbyAction: boolean;

  private readonly hasMicrophoneAction: boolean;

  private readonly hasDisplayAudioAction: boolean;

  private readonly shaderValueEl: HTMLSpanElement;

  private readonly surfaceStripEl: HTMLDivElement;

  private readonly liveStateEl: HTMLDivElement;

  private readonly statusTextEl: HTMLSpanElement;

  private readonly standbyButton: HTMLButtonElement;

  private readonly microphoneButton: HTMLButtonElement;

  private readonly displayAudioButton: HTMLButtonElement;

  private readonly audioMeters = new Map<string, MeterController>();

  private readonly feelingMeters = new Map<string, MeterController>();

  private readonly aiChipValues = new Map<string, HTMLSpanElement>();

  private readonly spectrumBars: HTMLDivElement[] = [];

  private readonly spectrogramCanvas: HTMLCanvasElement;

  private readonly spectrogramContext: CanvasRenderingContext2D | null;

  constructor({
    onStartMicrophoneAudio,
    onStartDisplayAudio,
    onStopAudioAnalyzer,
    onSelectSurface,
  }: {
    onStartMicrophoneAudio?: () => void;
    onStartDisplayAudio?: () => void;
    onStopAudioAnalyzer?: () => void;
    onSelectSurface?: (surfaceId: string) => void;
  }) {
    this.hasStandbyAction = Boolean(onStopAudioAnalyzer);
    this.hasMicrophoneAction = Boolean(onStartMicrophoneAudio);
    this.hasDisplayAudioAction = Boolean(onStartDisplayAudio);

    this.element = createElement('div', {
      display: 'grid',
      gap: '16px',
    });
    this.element.className = 'es-operator-layout';

    this.commandDeckElement = createElement('div');
    this.commandDeckElement.className = 'es-operator-strip';
    const commandDeck = this.commandDeckElement;

    const leftStrip = createElement('div');
    leftStrip.className = 'es-operator-strip__left';

    const shaderGroup = createElement('div');
    shaderGroup.className = 'es-operator-strip__group';
    shaderGroup.append(
      createElement('span', 'es-operator-strip__label', 'Shader'),
    );
    this.shaderValueEl = createElement('span', 'es-operator-strip__value', 'None');
    shaderGroup.append(this.shaderValueEl);

    const surfacesGroup = createElement('div');
    surfacesGroup.className = 'es-operator-strip__group es-operator-strip__group--surfaces';
    this.surfaceStripEl = createElement('div');
    this.surfaceStripEl.className = 'es-operator-strip__surfaces';
    surfacesGroup.append(this.surfaceStripEl);

    leftStrip.append(shaderGroup, surfacesGroup);

    const rightStrip = createElement('div');
    rightStrip.className = 'es-operator-strip__right';

    this.liveStateEl = createElement('div');
    this.liveStateEl.className = 'es-operator-strip__state';
    this.liveStateEl.append(
      createElement('span', 'es-operator-strip__state-dot'),
      createElement('span', 'es-operator-strip__state-label', 'IDLE'),
    );

    const controls = createElement('div');
    controls.className = 'es-operator-strip__controls';

    this.standbyButton = this._createTransportButton('power_settings_new', 'Standby', () => {
      onStopAudioAnalyzer?.();
    });
    this.microphoneButton = this._createTransportButton('mic', 'Mic', () => {
      onStartMicrophoneAudio?.();
    });
    this.displayAudioButton = this._createTransportButton('tv', 'Display', () => {
      onStartDisplayAudio?.();
    });
    controls.append(this.standbyButton, this.microphoneButton, this.displayAudioButton);

    rightStrip.append(this.liveStateEl, controls);
    commandDeck.append(leftStrip, rightStrip);

    this.signalMonitorElement = createElement('div');
    this.signalMonitorElement.className = 'es-operator-crt crt-panel';
    const monitorPanel = this.signalMonitorElement;

    const monitorInner = createElement('div');
    monitorInner.className = 'crt-panel__content es-monitor-shell';

    const monitorTitle = createElement('h2', {}, 'Monitor');
    monitorTitle.className = 'crt-title';
    const monitorSubtitle = createElement('p', {}, 'Audio + state');
    monitorSubtitle.className = 'crt-subtitle';

    const statusRow = createElement('div');
    statusRow.className = 'crt-status';
    const statusDot = createElement('span');
    statusDot.className = 'crt-status__dot';
    this.statusTextEl = createElement('span', {}, 'AI Enabled • Live Response • Fresh');
    statusRow.append(statusDot, this.statusTextEl);

    const monitorDividerTop = createElement('div');
    monitorDividerTop.className = 'crt-divider';

    const monitorGrid = createElement('div');
    monitorGrid.className = 'es-monitor-grid';

    const leftStack = createElement('div');
    leftStack.className = 'es-monitor-stack';
    leftStack.append(
      this._createSignalSection('Audio', '', AUDIO_UNIFORM_SCHEMA, this.audioMeters),
      this._createSignalSection('Feel', '', FEELING_UNIFORM_SCHEMA, this.feelingMeters),
    );

    const rightStack = createElement('div');
    rightStack.className = 'es-monitor-stack';
    rightStack.append(
      this._createAISection(),
    );

    monitorGrid.append(leftStack, rightStack);

    const spectrumGrid = createElement('div');
    spectrumGrid.className = 'es-spectrum-grid';

    const spectrumSection = createElement('div');
    spectrumSection.className = 'es-monitor-section es-spectrum-wrap';
    spectrumSection.append(
      this._createSectionHead('Spectrum', ''),
    );
    const spectrumBars = createElement('div');
    spectrumBars.className = 'es-spectrum-bars';
    for (let index = 0; index < 32; index += 1) {
      const bar = createElement('div');
      bar.className = 'es-spectrum-bar';
      spectrumBars.append(bar);
      this.spectrumBars.push(bar);
    }
    const spectrumMonitor = createElement('div');
    spectrumMonitor.className = 'crt-monitor';
    const spectrumGraph = createElement('div');
    spectrumGraph.className = 'crt-monitor__graph';
    const spectrumSweep = createElement('div');
    spectrumSweep.className = 'crt-monitor__sweep';
    const spectrumContent = createElement('div');
    spectrumContent.className = 'crt-monitor__content';
    spectrumContent.append(spectrumBars);
    spectrumMonitor.append(spectrumGraph, spectrumSweep, spectrumContent);
    spectrumSection.append(spectrumMonitor);

    const spectrogramSection = createElement('div');
    spectrogramSection.className = 'es-monitor-section es-spectrum-wrap';
    spectrogramSection.append(
      this._createSectionHead('Spectrogram', ''),
    );
    this.spectrogramCanvas = createElement('canvas') as HTMLCanvasElement;
    this.spectrogramCanvas.className = 'es-spectrogram';
    this.spectrogramCanvas.width = 360;
    this.spectrogramCanvas.height = 116;
    this.spectrogramContext = this.spectrogramCanvas.getContext('2d');
    const spectrogramMonitor = createElement('div');
    spectrogramMonitor.className = 'crt-monitor';
    const spectrogramGraph = createElement('div');
    spectrogramGraph.className = 'crt-monitor__graph';
    const spectrogramSweep = createElement('div');
    spectrogramSweep.className = 'crt-monitor__sweep';
    const spectrogramContent = createElement('div');
    spectrogramContent.className = 'crt-monitor__content';
    spectrogramContent.append(this.spectrogramCanvas);
    spectrogramMonitor.append(spectrogramGraph, spectrogramSweep, spectrogramContent);
    spectrogramSection.append(spectrogramMonitor);

    spectrumGrid.append(spectrumSection, spectrogramSection);

    const monitorDividerBottom = createElement('div');
    monitorDividerBottom.className = 'crt-divider';

    monitorInner.append(
      monitorTitle,
      monitorSubtitle,
      statusRow,
      monitorDividerTop,
      monitorGrid,
      monitorDividerBottom,
      spectrumGrid,
    );
    monitorPanel.append(monitorInner);

    this.element.append(commandDeck, monitorPanel);

    setButtonEnabled(this.standbyButton, this.hasStandbyAction);
    setButtonEnabled(this.microphoneButton, this.hasMicrophoneAction);
    setButtonEnabled(this.displayAudioButton, this.hasDisplayAudioAction);
  }

  update(state: ShaderMasterSnapshot, audioInputState: AudioAnalyzerState | null): void {
    const selectedOutput = state.outputs.find((output) => output.id === state.selectedOutputId) || null;
    const selectedSurface = state.surfaces.find((surface) => surface.id === state.selectedSurfaceId) || null;
    const routedSurfaceCount = selectedOutput
      ? state.surfaces.filter((surface) => surface.assignedOutputId === selectedOutput.id).length
      : state.surfaces.filter((surface) => surface.assignedOutputId !== null).length;
    const activeVisualState = state.visualState.transition ? state.visualState.target : state.visualState.current;

    this.shaderValueEl.textContent = selectedOutput?.presetLabel || activeVisualState?.recipeLabel || 'None';
    this.surfaceStripEl.replaceChildren();
    state.surfaces.forEach((surface, index) => {
      const chip = createElement('button');
      chip.type = 'button';
      chip.className = 'es-operator-strip__surface';
      chip.textContent = formatSurfaceChipLabel(surface.name, index);
      chip.dataset.selected = surface.id === state.selectedSurfaceId ? 'true' : 'false';
      chip.dataset.assigned = selectedOutput && surface.assignedOutputId === selectedOutput.id ? 'true' : 'false';
      chip.addEventListener('click', () => {
        onSelectSurface?.(surface.id);
      });
      this.surfaceStripEl.append(chip);
    });

    const liveState = resolveLiveState(audioInputState);
    this.liveStateEl.dataset.status = liveState.status;
    const liveStateLabel = this.liveStateEl.querySelector('.es-operator-strip__state-label');
    if (liveStateLabel) {
      liveStateLabel.textContent = liveState.label;
    }

    const isManual = !audioInputState || audioInputState.source === 'manual';
    const isMicrophone = audioInputState?.source === 'microphone';
    const isDisplay = audioInputState?.source === 'display';
    const isRequesting = audioInputState?.status === 'requesting';

    setButtonEnabled(this.microphoneButton, this.hasMicrophoneAction && (!isRequesting || isMicrophone));
    setButtonEnabled(this.displayAudioButton, this.hasDisplayAudioAction && (!isRequesting || isDisplay));
    setButtonEnabled(this.standbyButton, this.hasStandbyAction);
    setTransportButtonState(this.standbyButton, isManual);
    setTransportButtonState(this.microphoneButton, Boolean(isMicrophone));
    setTransportButtonState(this.displayAudioButton, Boolean(isDisplay));

    AUDIO_UNIFORM_SCHEMA.forEach((field) => {
      const controller = this.audioMeters.get(field.key);
      if (!controller) {
        return;
      }

      const value = typeof state.mappedAudioUniforms[field.key] === 'number'
        ? state.mappedAudioUniforms[field.key] as number
        : Number(field.defaultValue);
      this._updateMeter(controller, value);
    });

    FEELING_UNIFORM_SCHEMA.forEach((field) => {
      const controller = this.feelingMeters.get(field.key);
      if (!controller) {
        return;
      }

      const value = typeof state.effectiveFeelingUniforms[field.key] === 'number'
        ? state.effectiveFeelingUniforms[field.key] as number
        : Number(field.defaultValue);
      this._updateMeter(controller, value);
    });

    const aiState = state.aiState;
    this.statusTextEl.textContent = [
      aiState.aiEnabled ? 'AI Enabled' : 'AI Disabled',
      aiState.aiFallbackActive ? 'Fallback Active' : 'Live Response',
      aiState.aiStale ? 'Stale' : 'Fresh',
    ].join(' • ');
    this.aiChipValues.get('phraseState')!.textContent = aiState.musicalState.phraseState;
    this.aiChipValues.get('sectionState')!.textContent = aiState.musicalState.sectionState;
    this.aiChipValues.get('commitReason')!.textContent = aiState.musicalState.lastCommitReason || 'holding';
    this.aiChipValues.get('lastUpdate')!.textContent = formatAIUpdateTimestamp(aiState.lastAIUpdateTime);
    this.aiChipValues.get('tension')!.textContent = aiState.currentAIState.tension.toFixed(2);
    this.aiChipValues.get('glow')!.textContent = aiState.currentAIState.glow.toFixed(2);
    this.aiChipValues.get('fragmentation')!.textContent = aiState.currentAIState.fragmentation.toFixed(2);
    this.aiChipValues.get('stillness')!.textContent = aiState.currentAIState.stillness.toFixed(2);
    this.aiChipValues.get('flowBias')!.textContent = aiState.currentAIState.flowBias.toFixed(2);
    this.aiChipValues.get('warmth')!.textContent = aiState.currentAIState.warmth.toFixed(2);
    this.aiChipValues.get('confidence')!.textContent = aiState.musicalState.activityConfidence.toFixed(2);
    this.aiChipValues.get('changeStrength')!.textContent = aiState.musicalState.changeStrength.toFixed(2);

    const spectrumValues = audioInputState?.spectrumBars || [];
    this.spectrumBars.forEach((bar, index) => {
      const value = clamp01(spectrumValues[index] || 0);
      bar.style.height = `${Math.max(4, value * 100)}%`;
      bar.style.opacity = value > 0.02 ? '1' : '0.28';
    });

    this._renderSpectrogram(audioInputState?.spectrogramFrames || []);
  }

  private _createSummaryCell(container: HTMLDivElement, label: string): HTMLDivElement {
    const cell = createElement('div');
    cell.className = 'es-summary-cell';
    const labelEl = createElement('div', {}, label);
    labelEl.className = 'es-summary-cell-label';
    const value = createElement('div', {}, '--');
    value.className = 'es-summary-cell-value';
    cell.append(labelEl, value);
    container.append(cell);
    return value;
  }

  private _createTransportButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = createElement('button') as HTMLButtonElement;
    button.type = 'button';
    button.className = 'es-operator-strip__toggle';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', onClick);

    const iconEl = createElement('span');
    iconEl.className = 'material-symbols-outlined es-operator-strip__toggle-icon';
    iconEl.textContent = icon;
    button.append(iconEl);
    return button;
  }

  private _createSectionHead(title: string, meta: string): HTMLDivElement {
    const head = createElement('div');
    head.className = 'es-monitor-head';
    head.append(
      createElement('div', {}, title),
      createElement('div', {}, meta),
    );
    (head.firstChild as HTMLDivElement).className = 'es-monitor-title';
    (head.lastChild as HTMLDivElement).className = 'es-monitor-meta';
    return head;
  }

  private _createSignalSection(
    title: string,
    meta: string,
    fields: Array<{ key: string; label: string }>,
    controllerMap: Map<string, MeterController>,
  ): HTMLDivElement {
    const section = createElement('div');
    section.className = 'es-monitor-section';
    section.append(this._createSectionHead(title, meta));

    const grid = createElement('div');
    grid.className = 'es-signal-stack';

    fields.forEach((field) => {
      const row = createElement('div');
      row.className = 'es-meter-row';

      const copy = createElement('div');
      copy.className = 'es-meter-copy';
      const labelEl = createElement('span', {}, field.label.replace(/^Audio\s+|^Feel\s+/i, ''));
      labelEl.className = 'es-meter-label';
      const valueEl = createElement('span', {}, '0.00');
      valueEl.className = 'es-meter-value';
      copy.append(labelEl, valueEl);

      const track = createElement('div');
      track.className = 'es-meter-track';
      const fill = createElement('div');
      fill.className = 'es-meter-fill';
      track.append(fill);

      row.append(copy, track);
      grid.append(row);
      controllerMap.set(field.key, {
        valueEl,
        fillEl: fill,
      });
    });

    section.append(grid);
    return section;
  }

  private _createAISection(): HTMLDivElement {
    const section = createElement('div');
    section.className = 'es-monitor-section';
    section.append(this._createSectionHead('AI', ''));

    const grid = createElement('div');
    grid.className = 'es-ai-grid';

    [
      ['Phrase', 'phraseState'],
      ['Section', 'sectionState'],
      ['Commit', 'commitReason'],
      ['Update', 'lastUpdate'],
      ['Tension', 'tension'],
      ['Glow', 'glow'],
      ['Fragment', 'fragmentation'],
      ['Stillness', 'stillness'],
      ['Flow', 'flowBias'],
      ['Warmth', 'warmth'],
      ['Conf', 'confidence'],
      ['Change', 'changeStrength'],
    ].forEach(([label, key]) => {
      const chip = createElement('div');
      chip.className = 'es-monitor-chip';
      const labelEl = createElement('div', {}, label);
      labelEl.className = 'es-monitor-chip-label';
      const valueEl = createElement('div', {}, '--');
      valueEl.className = 'es-monitor-chip-value';
      chip.append(labelEl, valueEl);
      grid.append(chip);
      this.aiChipValues.set(key, valueEl);
    });

    section.append(grid);
    return section;
  }

  private _updateMeter(controller: MeterController, value: number): void {
    const clamped = clamp01(value);
    controller.valueEl.textContent = clamped.toFixed(2);
    controller.fillEl.style.width = `${clamped * 100}%`;
  }

  private _renderSpectrogram(frames: number[][]): void {
    if (!this.spectrogramContext) {
      return;
    }

    const ctx = this.spectrogramContext;
    const width = this.spectrogramCanvas.width;
    const height = this.spectrogramCanvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(6, 12, 6, 0.96)';
    ctx.fillRect(0, 0, width, height);

    if (frames.length === 0) {
      return;
    }

    const columnWidth = width / frames.length;
    const bandCount = frames[0]?.length || 0;
    if (bandCount === 0) {
      return;
    }

    const rowHeight = height / bandCount;
    frames.forEach((frame, frameIndex) => {
      frame.forEach((value, bandIndex) => {
        const amplitude = clamp01(value);
        const x = frameIndex * columnWidth;
        const y = height - ((bandIndex + 1) * rowHeight);
        const hue = 86 + (amplitude * 8);
        const saturation = 28 + (amplitude * 36);
        const lightness = 10 + (amplitude * 56);
        ctx.fillStyle = `hsl(${hue} ${saturation}% ${lightness}%)`;
        ctx.fillRect(x, y, Math.ceil(columnWidth), Math.ceil(rowHeight));
      });
    });
  }
}
