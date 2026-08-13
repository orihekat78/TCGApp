import type { GameState } from '../types/game-state.js';

export type IndexedZone = 'evidence' | 'remove';
export type IndexedZoneEpochs = {
  self: Record<IndexedZone, number>;
  opp: Record<IndexedZone, number>;
};

type IndexedZoneEpochState = Pick<GameState, 'indexedZoneEpochs'>;

export function ensureIndexedZoneEpochs(
  state: IndexedZoneEpochState,
): IndexedZoneEpochs {
  const current = state.indexedZoneEpochs;
  if (current) {
    if (indexedZoneEpoch(state, 'self', 'evidence') !== undefined
      && indexedZoneEpoch(state, 'self', 'remove') !== undefined
      && indexedZoneEpoch(state, 'opp', 'evidence') !== undefined
      && indexedZoneEpoch(state, 'opp', 'remove') !== undefined) return current;
    throw new Error('Invalid indexed zone epochs');
  }
  const initialized: IndexedZoneEpochs = {
    self: { evidence: 0, remove: 0 },
    opp: { evidence: 0, remove: 0 },
  };
  state.indexedZoneEpochs = initialized;
  return initialized;
}

export function indexedZoneEpoch(
  state: IndexedZoneEpochState,
  player: 'self' | 'opp',
  area: IndexedZone,
): number | undefined {
  const value = state.indexedZoneEpochs?.[player]?.[area];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function advanceIndexedZoneEpoch(
  state: IndexedZoneEpochState,
  player: 'self' | 'opp',
  area: IndexedZone,
): number {
  const current = indexedZoneEpoch(state, player, area) ?? 0;
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new Error(`indexed zone epoch overflow: ${player}.${area}`);
  }
  ensureIndexedZoneEpochs(state)[player][area] = current + 1;
  return current + 1;
}
