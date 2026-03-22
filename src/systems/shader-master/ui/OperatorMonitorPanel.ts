import { AUDIO_UNIFORM_SCHEMA, FEELING_UNIFORM_SCHEMA } from '../contracts/uniforms.ts';
import type { ShaderMasterSnapshot } from '../contracts/types.ts';
import type { AudioAnalyzerState } from '../../audio-analyzer/audioAnalyzerStore.ts';
import { createButton, createElement, createTag, setButtonEnabled } from './dom.ts';

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

function formatSourceLabel(audioInputState: AudioAnalyzerState | null): string {
  if (!audioInputState) {
    return 'Manual';
  }

  if (audioInputState.source === 'microphone') {
    return 'Microphone';
  }

  if (audioInputState.source === 'display') {
    return 'Display';
  }

  if (audioInputState.source === 'test-generator') {
    return 'Debug Test';
  }

  return 'Manual';
}

function formatStatusLabel(audioInputState: AudioAnalyzerState | null): string {
  if (!audioInputState) {
    return 'idle';
  }

  if (audioInputState.status === 'requesting') {
    return 'requesting';
  }

  if (audioInputState.status === 'running') {
    return 'running';
  }

  if (audioInputState.status === 'error') {
    return 'error';
  }

  return 'idle';
}

function formatAIUpdateTimestamp(timestampMs: number | null): string {
  if (timestampMs === null) {
    return 'Awaiting sync';
  }

  const secondsAgo = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  return `${new Date(timestampMs).toLocaleTimeString()} • ${secondsAgo}s ago`;
}

function setTransportButtonState(button: HTMLButtonElement, active: boolean, accent: string): void {
  button.dataset.active = active ? 'true' : 'false';
  button.dataset.activeAccent = accent;
  button.style.borderColor = active ? accent : 'rgba(120, 170, 96, 0.28)';
  button.style.background = active
    ? `${accent}18`
    : 'linear-gradient(180deg, rgba(15, 30, 14, 0.96) 0%, rgba(7, 18, 7, 0.98) 100%)';
  button.style.color = active ? '#f0ffe9' : '#d5f7c4';
  button.style.boxShadow = active ? `0 0 0 1px ${accent}33 inset, 0 0 16px ${accent}18` : 'none';
}

export class OperatorMonitorPanel {
  readonly element: HTMLDivElement;

  readonly commandDeckElement: HTMLDivElement;

  readonly signalMonitorElement: HTMLDivElement;

  private readonly hasStandbyAction: boolean;

  private readonly hasMicrophoneAction: boolean;

  private readonly hasDisplayAudioAction: boolean;

  private readonly outputValueEl: HTMLDivElement;

  private readonly presetValueEl: HTMLDivElement;

  private readonly routingValueEl: HTMLDivElement;

  private readonly liveStateValueEl: HTMLDivElement;

  private readonly sourceTagEl: HTMLSpanElement;

  private readonly statusTagEl: HTMLSpanElement;

  private readonly aiTagEl: HTMLSpanElement;

  private readonly analyzerMetaEl: HTMLDivElement;

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
  }: {
    onStartMicrophoneAudio?: () => void;
    onStartDisplayAudio?: () => void;
    onStopAudioAnalyzer?: () => void;
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
    this.commandDeckElement.className = 'es-machine-panel es-operator-command';
    const commandDeck = this.commandDeckElement;

    const commandCopy = createElement('div');
    commandCopy.className = 'es-command-copy';

    const leftCopy = createElement('div');
    leftCopy.className = 'es-command-stats';
    leftCopy.append(
      createElement('div', { fontSize: '18px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--es-text-strong)' }, 'Operator Console'),
      createElement('div', { fontSize: '12px', lineHeight: '1.6', color: 'var(--es-text-dim)' }, 'Live shader operation view. Signal flow, AI response, spectrum activity, and audio capture controls stay in one compact machine panel.'),
    );

    const summaryGrid = createElement('div');
    summaryGrid.className = 'es-summary-grid';
    this.outputValueEl = this._createSummaryCell(summaryGrid, 'Selected Output');
    this.presetValueEl = this._createSummaryCell(summaryGrid, 'Preset');
    this.routingValueEl = this._createSummaryCell(summaryGrid, 'Routing');
    this.liveStateValueEl = this._createSummaryCell(summaryGrid, 'Live State');

    const commandBadges = createElement('div');
    commandBadges.className = 'es-badge-row';
    this.sourceTagEl = createTag('Source: Manual');
    this.statusTagEl = createTag('Status: idle');
    this.aiTagEl = createTag('AI: Live');
    commandBadges.append(this.sourceTagEl, this.statusTagEl, this.aiTagEl);

    leftCopy.append(summaryGrid, commandBadges);

    const rightCopy = createElement('div');
    rightCopy.className = 'es-command-stats';
    rightCopy.append(
      createElement('div', { fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--es-text-dim)' }, 'Capture Controls'),
      createElement('div', { fontSize: '12px', lineHeight: '1.6', color: 'var(--es-text-dim)' }, 'Use the same analyzer actions as the developer tools without opening the debug console.'),
    );
    this.analyzerMetaEl = createElement('div', {
      fontSize: '12px',
      lineHeight: '1.55',
      color: 'var(--es-text-strong)',
    }, 'Manual standby is active.');
    rightCopy.append(this.analyzerMetaEl);

    commandCopy.append(leftCopy, rightCopy);

    const actions = createElement('div');
    actions.className = 'es-command-actions';

    const actionRow = createElement('div');
    actionRow.className = 'es-command-action-row';
    this.standbyButton = createButton('Standby', () => {
      onStopAudioAnalyzer?.();
    });
    this.microphoneButton = createButton('Use Microphone', () => {
      onStartMicrophoneAudio?.();
    });
    this.displayAudioButton = createButton('Display Audio', () => {
      onStartDisplayAudio?.();
    });
    actionRow.append(this.standbyButton, this.microphoneButton, this.displayAudioButton);
    actions.append(
      actionRow,
      createElement('div', {
        fontSize: '11px',
        color: 'var(--es-text-dim)',
        textAlign: 'right',
      }, 'Developer diagnostics keeps tests, latency probes, mappings, and analyzer tuning hidden until needed.'),
    );

    commandDeck.append(commandCopy, actions);

    this.signalMonitorElement = createElement('div');
    this.signalMonitorElement.className = 'es-operator-crt crt-panel crt-flicker';
    const monitorPanel = this.signalMonitorElement;

    const monitorInner = createElement('div');
    monitorInner.className = 'crt-panel__content es-monitor-shell';

    const monitorTitle = createElement('h2', {}, 'Signal Monitor');
    monitorTitle.className = 'crt-title';
    const monitorSubtitle = createElement('p', {}, 'Audio, feeling, AI state, spectrum, and spectrogram merged into a compact operator display.');
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
      this._createSignalSection('Audio Bus', 'Effective mapped audio values reaching the shader outputs.', AUDIO_UNIFORM_SCHEMA, this.audioMeters),
      this._createSignalSection('Feeling Layer', 'Effective feeling state after AI/manual resolution.', FEELING_UNIFORM_SCHEMA, this.feelingMeters),
    );

    const rightStack = createElement('div');
    rightStack.className = 'es-monitor-stack';
    rightStack.append(
      this._createAISection(),
      this._createTelemetrySection(),
    );

    monitorGrid.append(leftStack, rightStack);

    const spectrumGrid = createElement('div');
    spectrumGrid.className = 'es-spectrum-grid';

    const spectrumSection = createElement('div');
    spectrumSection.className = 'es-monitor-section es-spectrum-wrap';
    spectrumSection.append(
      this._createSectionHead('Spectrum', 'Instant band energy'),
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
      this._createSectionHead('Spectrogram', 'Time scrolls left to right'),
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

    this.outputValueEl.textContent = selectedOutput?.name || 'No output selected';
    this.presetValueEl.textContent = selectedOutput?.presetLabel || 'No preset loaded';
    this.routingValueEl.textContent = selectedOutput
      ? `${routedSurfaceCount}/${state.surfaces.length} surfaces on ${selectedOutput.name}`
      : `${routedSurfaceCount}/${state.surfaces.length} routed`;
    this.liveStateValueEl.textContent = activeVisualState
      ? `${activeVisualState.recipeLabel} • ${activeVisualState.outputId}`
      : selectedSurface
        ? `Surface focus • ${selectedSurface.name}`
        : 'Manual / custom state';

    this.sourceTagEl.textContent = `Source: ${formatSourceLabel(audioInputState)}`;
    this.statusTagEl.textContent = `Status: ${formatStatusLabel(audioInputState)}`;
    this.aiTagEl.textContent = `AI: ${state.aiState.aiFallbackActive ? 'Fallback' : (state.aiState.aiEnabled ? 'Live' : 'Disabled')}`;

    const isManual = !audioInputState || audioInputState.source === 'manual';
    const isMicrophone = audioInputState?.source === 'microphone';
    const isDisplay = audioInputState?.source === 'display';
    const isRequesting = audioInputState?.status === 'requesting';

    this.analyzerMetaEl.textContent = isManual
      ? 'Manual standby is active. Audio values shown here are the current effective shader inputs.'
      : isMicrophone
        ? 'Microphone analysis is live. Monitor the mapped bus and AI response together while performing.'
        : isDisplay
          ? 'Display audio capture is live. Useful when routing system audio directly into the analyzer.'
          : 'Developer test input is active. Operator console remains read-only while diagnostics drive the analyzer.';

    setButtonEnabled(this.microphoneButton, this.hasMicrophoneAction && (!isRequesting || isMicrophone));
    setButtonEnabled(this.displayAudioButton, this.hasDisplayAudioAction && (!isRequesting || isDisplay));
    setButtonEnabled(this.standbyButton, this.hasStandbyAction);
    setTransportButtonState(this.standbyButton, isManual, '#d7d38a');
    setTransportButtonState(this.microphoneButton, Boolean(isMicrophone), '#8cff98');
    setTransportButtonState(this.displayAudioButton, Boolean(isDisplay), '#d5f7c4');

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
    section.append(this._createSectionHead('AI State', 'Musical state and feeling bias'));

    const grid = createElement('div');
    grid.className = 'es-ai-grid';

    [
      ['Phrase', 'phraseState'],
      ['Section', 'sectionState'],
      ['Commit', 'commitReason'],
      ['Last Update', 'lastUpdate'],
      ['Tension', 'tension'],
      ['Glow', 'glow'],
      ['Fragment', 'fragmentation'],
      ['Stillness', 'stillness'],
      ['Flow Bias', 'flowBias'],
      ['Warmth', 'warmth'],
      ['Confidence', 'confidence'],
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

  private _createTelemetrySection(): HTMLDivElement {
    const section = createElement('div');
    section.className = 'es-monitor-section';
    section.append(this._createSectionHead('Operator Note', 'Readable state without diagnostics clutter'));
    section.append(
      createElement('div', {
        fontSize: '12px',
        lineHeight: '1.6',
        color: 'var(--es-text-dim)',
      }, 'Detailed recipes, analyzer tuning, latency tools, test generators, and audio visual mapping stay available in Developer Debug Mode so normal operation remains compact and glanceable.'),
    );
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
