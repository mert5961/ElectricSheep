function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeWaveformEnergy(timeDomainData: Uint8Array): number {
  if (timeDomainData.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  for (let index = 0; index < timeDomainData.length; index += 1) {
    const centeredSample = (timeDomainData[index] - 128) / 128;
    sumSquares += centeredSample * centeredSample;
  }

  const rms = Math.sqrt(sumSquares / timeDomainData.length);
  return clamp01(Math.pow(rms * 2.35, 0.82));
}
