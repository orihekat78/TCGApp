import type { DeclaredAbilityHostOrigin } from '../types/effect-ctx.js';

type AbilitySourceIdentity = {
  setCardId?: unknown;
  setCardInstanceId?: unknown;
  abilityOrigin?: unknown;
  abilityIndex?: unknown;
  abilityId?: unknown;
};

/** Reject an occurrence-bound source unless every required witness is complete. */
export function assertAbilitySourceIdentity(source: AbilitySourceIdentity): void {
  const hasSetCardId = source.setCardId !== undefined;
  const hasSetCardInstanceId = source.setCardInstanceId !== undefined;
  if (hasSetCardId !== hasSetCardInstanceId) {
    throw new Error('set-card source requires both setCardId and setCardInstanceId');
  }
  if (hasSetCardId && (
    typeof source.setCardId !== 'string'
    || source.setCardId.length === 0
    || typeof source.setCardInstanceId !== 'string'
    || source.setCardInstanceId.length === 0
  )) {
    throw new Error('set-card source requires non-empty string setCardId and setCardInstanceId');
  }
  const hasAbilityOrigin = source.abilityOrigin !== undefined;
  const hasAbilityIndex = source.abilityIndex !== undefined;
  if (hasAbilityOrigin !== hasAbilityIndex) {
    throw new Error('declared-ability source requires both abilityOrigin and abilityIndex');
  }
  if (hasAbilityOrigin) {
    if (source.abilityOrigin !== 'printed' && source.abilityOrigin !== 'granted') {
      throw new Error('declared-ability source has invalid abilityOrigin');
    }
    if (!Number.isSafeInteger(source.abilityIndex) || (source.abilityIndex as number) < 0) {
      throw new Error('declared-ability source has invalid abilityIndex');
    }
    if (typeof source.abilityId !== 'string' || source.abilityId.length === 0) {
      throw new Error('declared-ability source requires abilityId');
    }
  }
  if (hasSetCardId && hasAbilityOrigin) {
    throw new Error('set-card and host declared-ability source witnesses are mutually exclusive');
  }
}

/** Backward-compatible name for callers that only write set-card identity. */
export function assertCompleteSetCardSource(source: AbilitySourceIdentity): void {
  assertAbilitySourceIdentity(source);
}

export function declaredAbilityHostWitness(source: AbilitySourceIdentity):
  | { abilityOrigin: DeclaredAbilityHostOrigin; abilityIndex: number }
  | undefined {
  assertAbilitySourceIdentity(source);
  if (source.abilityOrigin === undefined || source.abilityIndex === undefined) return undefined;
  return {
    abilityOrigin: source.abilityOrigin as DeclaredAbilityHostOrigin,
    abilityIndex: source.abilityIndex as number,
  };
}

export type DeclaredAbilityUseCountSource = {
  abilityOrigin?: DeclaredAbilityHostOrigin;
  abilityIndex?: number;
};

/** Exact host occurrence key. Calls without a witness retain the legacy ability-id key. */
export function declaredAbilityUseCountKey(
  abilityId: string,
  source?: DeclaredAbilityUseCountSource,
): string {
  assertAbilitySourceIdentity({
    abilityId,
    abilityOrigin: source?.abilityOrigin,
    abilityIndex: source?.abilityIndex,
  });
  if (source?.abilityOrigin === undefined || source.abilityIndex === undefined) return abilityId;
  return `@declared-occurrence:${JSON.stringify([abilityId, source.abilityOrigin, source.abilityIndex])}`;
}

function safeDeclaredAbilityUseCount(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? value as number
    : Number.MAX_SAFE_INTEGER;
}

function validTurnScopedUseCount(
  value: unknown,
): { turn: number; count: number } | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.turn) || (record.turn as number) < 0) return undefined;
  if (!Number.isSafeInteger(record.count) || (record.count as number) < 0) return undefined;
  return { turn: record.turn as number, count: record.count as number };
}

/** Malformed current-turn records are treated as fully consumed. */
export function readTurnScopedUseCount(value: unknown, currentTurn: number): number {
  if (value === undefined) return 0;
  const valid = validTurnScopedUseCount(value);
  if (!valid) return Number.MAX_SAFE_INTEGER;
  return valid.turn === currentTurn ? valid.count : 0;
}

export function incrementTurnScopedUseCount(
  value: unknown,
  currentTurn: number,
): { turn: number; count: number } {
  const current = readTurnScopedUseCount(value, currentTurn);
  return {
    turn: currentTurn,
    count: current >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : current + 1,
  };
}

export function hasValidTurnScopedUse(
  value: unknown,
  currentTurn: number,
): boolean {
  const valid = validTurnScopedUseCount(value);
  return valid?.turn === currentTurn && valid.count >= 1;
}

/** Read an exact occurrence, falling back to an ambiguous pre-Wave35 save key. */
export function readDeclaredAbilityUseCountRecord(
  record: Readonly<Record<string, number>> | undefined,
  abilityId: string,
  source?: DeclaredAbilityUseCountSource,
  keyPrefix = '',
): number {
  const exact = safeDeclaredAbilityUseCount(
    record?.[`${keyPrefix}${declaredAbilityUseCountKey(abilityId, source)}`],
  );
  if (source?.abilityOrigin !== undefined && source.abilityIndex !== undefined && exact !== undefined) {
    return exact;
  }
  if (source?.abilityOrigin === undefined || source.abilityIndex === undefined) {
    let greatest = exact ?? 0;
    const abilityPrefix = `${keyPrefix}@declared-occurrence:${JSON.stringify([abilityId]).slice(0, -1)},`;
    for (const [key, count] of Object.entries(record ?? {})) {
      if (!key.startsWith(abilityPrefix)) continue;
      greatest = Math.max(greatest, safeDeclaredAbilityUseCount(count) ?? 0);
    }
    return greatest;
  }
  return safeDeclaredAbilityUseCount(record?.[`${keyPrefix}${abilityId}`]) ?? 0;
}

/** Seed an exact occurrence from a legacy count before incrementing it. */
export function incrementDeclaredAbilityUseCountRecord(
  record: Record<string, number>,
  abilityId: string,
  source?: DeclaredAbilityUseCountSource,
  keyPrefix = '',
): void {
  const key = `${keyPrefix}${declaredAbilityUseCountKey(abilityId, source)}`;
  const current = readDeclaredAbilityUseCountRecord(record, abilityId, source, keyPrefix);
  record[key] = current >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : current + 1;
}
