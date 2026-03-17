function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeWaveformEnergy(
  timeDomainData: Uint8Array,
  noiseFloor = 0,
): number {
  if (timeDomainData.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  for (let index = 0; index < timeDomainData.length; index += 1) {
    const centeredSample = (timeDomainData[index] - 128) / 128;
    sumSquares += centeredSample * centeredSample;
  }

  const rms = Math.sqrt(sumSquares / timeDomainData.length);
  const raw = Math.pow(rms * 2.35, 0.82);

  if (noiseFloor > 0 && raw <= noiseFloor) {
    return 0;
  }

  if (noiseFloor > 0) {
    const headroom = Math.max(0.001, 1 - noiseFloor);
    return clamp01((raw - noiseFloor) / headroom);
  }

  return clamp01(raw);
}
