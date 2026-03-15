import type { AudioAnalyzerTestMode } from './audioAnalyzerStore.ts';

export interface AudioDebugTestDefinition {
  id: AudioAnalyzerTestMode;
  label: string;
  description: string;
  group: 'Static Tones' | 'Dynamic Tests';
}

export const AUDIO_DEBUG_TESTS: AudioDebugTestDefinition[] = [
  {
    id: 'bass-tone',
    label: 'Bass Tone',
    description: '80 Hz sine tone',
    group: 'Static Tones',
  },
  {
    id: 'mid-tone',
    label: 'Mid Tone',
    description: '700 Hz sine tone',
    group: 'Static Tones',
  },
  {
    id: 'treble-tone',
    label: 'Treble Tone',
    description: '5200 Hz sine tone',
    group: 'Static Tones',
  },
  {
    id: 'step-test',
    label: 'Step Test',
    description: 'Hard 0→1→0 gain steps',
    group: 'Dynamic Tests',
  },
  {
    id: 'ramp-test',
    label: 'Ramp Test',
    description: 'Linear fade up/down',
    group: 'Dynamic Tests',
  },
  {
    id: 'sweep-test',
    label: 'Sweep Test',
    description: 'Low-to-high frequency sweep',
    group: 'Dynamic Tests',
  },
  {
    id: 'pulse-click',
    label: 'Pulse Train',
    description: 'Regular transient spikes',
    group: 'Dynamic Tests',
  },
];

interface DebugTestHandle {
  nodes: AudioNode[];
  stop: () => void;
}

function createContinuousToneHandle({
  context,
  analyserNode,
  frequency,
  gain,
}: {
  context: AudioContext;
  analyserNode: AnalyserNode;
  frequency: number;
  gain: number;
}): DebugTestHandle {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  const gainNode = context.createGain();
  gainNode.gain.value = gain;

  oscillator.connect(gainNode);
  gainNode.connect(analyserNode);
  oscillator.start();

  let stopped = false;
  return {
    nodes: [oscillator, gainNode],
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      oscillator.stop();
    },
  };
}

function createStepTestHandle({
  context,
  analyserNode,
}: {
  context: AudioContext;
  analyserNode: AnalyserNode;
}): DebugTestHandle {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 700;

  const gainNode = context.createGain();
  gainNode.gain.value = 0;

  oscillator.connect(gainNode);
  gainNode.connect(analyserNode);
  oscillator.start();

  const cycleMs = 1600;
  const highDurationMs = 700;
  const scheduleStep = (): void => {
    const now = context.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.setValueAtTime(0.42, now + 0.08);
    gainNode.gain.setValueAtTime(0.42, now + (highDurationMs / 1000));
    gainNode.gain.setValueAtTime(0.0001, now + ((highDurationMs + 0.01) / 1000));
  };

  scheduleStep();
  const intervalId = window.setInterval(scheduleStep, cycleMs);

  let stopped = false;
  return {
    nodes: [oscillator, gainNode],
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      window.clearInterval(intervalId);
      oscillator.stop();
    },
  };
}

function createRampTestHandle({
  context,
  analyserNode,
}: {
  context: AudioContext;
  analyserNode: AnalyserNode;
}): DebugTestHandle {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 700;

  const gainNode = context.createGain();
  gainNode.gain.value = 0.0001;

  oscillator.connect(gainNode);
  gainNode.connect(analyserNode);
  oscillator.start();

  const cycleDurationMs = 3200;
  const scheduleRamp = (): void => {
    const now = context.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.46, now + 1.4);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + 2.8);
  };

  scheduleRamp();
  const intervalId = window.setInterval(scheduleRamp, cycleDurationMs);

  let stopped = false;
  return {
    nodes: [oscillator, gainNode],
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      window.clearInterval(intervalId);
      oscillator.stop();
    },
  };
}

function createSweepTestHandle({
  context,
  analyserNode,
}: {
  context: AudioContext;
  analyserNode: AnalyserNode;
}): DebugTestHandle {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 50;

  const gainNode = context.createGain();
  gainNode.gain.value = 0.34;

  oscillator.connect(gainNode);
  gainNode.connect(analyserNode);
  oscillator.start();

  const sweepDurationMs = 4200;
  const scheduleSweep = (): void => {
    const now = context.currentTime;
    oscillator.frequency.cancelScheduledValues(now);
    oscillator.frequency.setValueAtTime(50, now);
    oscillator.frequency.exponentialRampToValueAtTime(8000, now + (sweepDurationMs / 1000) - 0.02);
  };

  scheduleSweep();
  const intervalId = window.setInterval(scheduleSweep, sweepDurationMs);

  let stopped = false;
  return {
    nodes: [oscillator, gainNode],
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      window.clearInterval(intervalId);
      oscillator.stop();
    },
  };
}

function triggerPulseBurst(context: AudioContext, gainNode: GainNode): void {
  const now = context.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(0.9, now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
}

function createPulseTestHandle({
  context,
  analyserNode,
}: {
  context: AudioContext;
  analyserNode: AnalyserNode;
}): DebugTestHandle {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 96;

  const gainNode = context.createGain();
  gainNode.gain.value = 0.0001;

  oscillator.connect(gainNode);
  gainNode.connect(analyserNode);
  oscillator.start();
  triggerPulseBurst(context, gainNode);

  const intervalId = window.setInterval(() => {
    triggerPulseBurst(context, gainNode);
  }, 500);

  let stopped = false;
  return {
    nodes: [oscillator, gainNode],
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      window.clearInterval(intervalId);
      oscillator.stop();
    },
  };
}

export function getAudioDebugTestLabel(mode: AudioAnalyzerTestMode | null): string {
  return AUDIO_DEBUG_TESTS.find((entry) => entry.id === mode)?.label || 'No Test';
}

export function createAudioDebugTestHandle({
  mode,
  context,
  analyserNode,
}: {
  mode: AudioAnalyzerTestMode;
  context: AudioContext;
  analyserNode: AnalyserNode;
}): DebugTestHandle {
  if (mode === 'bass-tone') {
    return createContinuousToneHandle({
      context,
      analyserNode,
      frequency: 80,
      gain: 0.44,
    });
  }

  if (mode === 'mid-tone') {
    return createContinuousToneHandle({
      context,
      analyserNode,
      frequency: 700,
      gain: 0.36,
    });
  }

  if (mode === 'treble-tone') {
    return createContinuousToneHandle({
      context,
      analyserNode,
      frequency: 5200,
      gain: 0.32,
    });
  }

  if (mode === 'step-test') {
    return createStepTestHandle({
      context,
      analyserNode,
    });
  }

  if (mode === 'ramp-test') {
    return createRampTestHandle({
      context,
      analyserNode,
    });
  }

  if (mode === 'sweep-test') {
    return createSweepTestHandle({
      context,
      analyserNode,
    });
  }

  return createPulseTestHandle({
    context,
    analyserNode,
  });
}
