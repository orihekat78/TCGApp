import { isRegisteredCardNameMigrationSource } from '../../effect/declared-name-domain.js';

let compatibilityDepth = 0;
let declaredNameCompatibilityDepth = 0;

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

export function withLegacyReplayDeclaredNameCompatibility<T>(run: () => T): T {
  declaredNameCompatibilityDepth += 1;
  try {
    return run();
  } finally {
    declaredNameCompatibilityDepth -= 1;
  }
}

export function isLegacyReplayDeclaredNameCompatibilityActive(): boolean {
  return declaredNameCompatibilityDepth > 0;
}

export function withLegacyReplayCompatibility<T>(run: () => T): T {
  return withLegacyReplayHiramekiCompatibility(
    () => withLegacyReplayDeclaredNameCompatibility(run),
  );
}

export function isLegacyReplayRegisteredCardNameSource(source: {
  cardId?: string;
  abilityId?: string;
  area?: string;
  setCardId?: string;
  setCardInstanceId?: string;
  abilityOrigin?: string;
  abilityIndex?: number;
}): boolean {
  return isLegacyReplayDeclaredNameCompatibilityActive()
    && isRegisteredCardNameMigrationSource(source);
}
