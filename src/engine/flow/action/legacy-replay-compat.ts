let compatibilityDepth = 0;

/**
 * Legacy V1/V2 replays predate causal checkpoints. Keep their compatibility
 * scoped to one synchronous playback so live engine admission stays strict.
 */
export function withLegacyReplayHiramekiCompatibility<T>(run: () => T): T {
  compatibilityDepth += 1;
  try {
    return run();
  } finally {
    compatibilityDepth -= 1;
  }
}

export function isLegacyReplayHiramekiCompatibilityActive(): boolean {
  return compatibilityDepth > 0;
}
