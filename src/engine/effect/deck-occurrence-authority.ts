import type { Candidate, EffectCtx, GameState } from '../types/index.js';
import { advanceIndexedZoneEpoch } from '../state/indexed-zone-epoch.js';
import {
  cardOccurrenceUid,
  cardOccurrenceWitness,
  isLiveCardOccurrenceWitness,
} from '../target/card-occurrence.js';
import {
  ownsLivePendingRuntimeBindings,
  visitPendingRuntimeBindingRecords,
} from './runtime-state.js';

type Player = 'self' | 'opp';

export type DeckOccurrenceAuthority = {
  kind: 'card';
  uid: string;
  cardId: string;
  area: 'deck';
  player: Player;
  index: number;
  occurrenceWitness: string;
};

export type DeckBindingRebaseOptions = {
  /** Exact cards inserted before every surviving original deck occurrence. */
  insertedBeforeSurvivors?: number;
  /** Selected occurrences that remain in the deck at exact new indexes. */
  relocatedOccurrences?: readonly { originalIndex: number; newIndex: number }[];
  /** Additional detached continuation contexts owned by the current decision. */
  additionalContexts?: readonly EffectCtx[];
  /**
   * Current-context binding keys whose selected occurrence has resolved out of
   * the deck but remains meaningful to later conditional steps.
   */
  preserveRemovedBindingKeysAsResolved?: readonly string[];
};

export type DeckOccurrencePlacement = {
  cardId: string;
  index: number;
};

export function deckOccurrenceAuthority(
  state: GameState,
  player: Player,
  index: number,
  witness?: string,
): DeckOccurrenceAuthority | null {
  const currentWitness = cardOccurrenceWitness(state, player, 'deck');
  if (witness !== undefined && witness !== currentWitness) return null;
  const cardId = state.players[player].deck[index];
  if (cardId === undefined) return null;
  return {
    kind: 'card',
    uid: cardOccurrenceUid(player, 'deck', cardId, index),
    cardId,
    area: 'deck',
    player,
    index,
    occurrenceWitness: currentWitness,
  };
}

export function isLiveDeckOccurrenceAuthority(
  state: GameState,
  player: Player,
  value: unknown,
): value is DeckOccurrenceAuthority {
  if (value === null || typeof value !== 'object') return false;
  const occurrence = value as Partial<DeckOccurrenceAuthority>;
  return occurrence.kind === 'card'
    && occurrence.area === 'deck'
    && occurrence.player === player
    && typeof occurrence.cardId === 'string'
    && typeof occurrence.index === 'number'
    && Number.isSafeInteger(occurrence.index)
    && occurrence.index >= 0
    && typeof occurrence.occurrenceWitness === 'string'
    && isLiveCardOccurrenceWitness(state, player, 'deck', occurrence.occurrenceWitness)
    && occurrence.uid === cardOccurrenceUid(player, 'deck', occurrence.cardId, occurrence.index)
    && state.players[player].deck[occurrence.index] === occurrence.cardId;
}

export function isLiveDeckWindowAuthority(
  state: GameState,
  player: Player,
  args: Record<string, unknown>,
): boolean {
  const witness = args.__windowWitness;
  const ids = args.__windowIds;
  const occurrences = args.__windowOccurrences;
  if (typeof witness !== 'string'
    || !isLiveCardOccurrenceWitness(state, player, 'deck', witness)
    || !Array.isArray(ids)
    || !Array.isArray(occurrences)
    || ids.length !== occurrences.length) return false;
  const indexes = new Set<number>();
  return occurrences.every((occurrence, position) => {
    if (!isLiveDeckOccurrenceAuthority(state, player, occurrence)
      || occurrence.occurrenceWitness !== witness
      || occurrence.cardId !== ids[position]
      || indexes.has(occurrence.index)) return false;
    indexes.add(occurrence.index);
    return true;
  });
}

/**
 * Commit one exact deck removal and renew only the surviving deck bindings.
 * Call after the deck array has reached its final shape for this atomic move.
 */
export function advanceDeckEpochAndRebaseBindings(
  state: GameState,
  ctx: EffectCtx,
  player: Player,
  removedOriginalIndexes: readonly number[],
  options: DeckBindingRebaseOptions = {},
): void {
  const previousWitness = cardOccurrenceWitness(state, player, 'deck');
  advanceIndexedZoneEpoch(state, player, 'deck');
  const currentBindings = ctx.bindings ?? (ctx.bindings = {});
  const records: Record<string, unknown>[] = [currentBindings];
  for (const additional of options.additionalContexts ?? []) records.push(additional.bindings);
  for (const entry of state.pendingEffects) {
    if (entry.bindings) records.push(entry.bindings as Record<string, unknown>);
  }
  if (ownsLivePendingRuntimeBindings(state)) {
    visitPendingRuntimeBindingRecords(bindings => records.push(bindings));
  }

  const visited = new Set<Record<string, unknown>>();
  for (const bindings of records) {
    if (visited.has(bindings)) continue;
    visited.add(bindings);
    rebaseDeckBindingRecordAfterEpoch(
      state,
      bindings,
      player,
      removedOriginalIndexes,
      previousWitness,
      bindings === currentBindings
        ? options
        : { ...options, preserveRemovedBindingKeysAsResolved: undefined },
    );
  }
}

function rebaseDeckBindingRecordAfterEpoch(
  state: GameState,
  bindings: Record<string, unknown>,
  player: Player,
  removedOriginalIndexes: readonly number[],
  previousWitness: string,
  options: DeckBindingRebaseOptions = {},
): void {
  const removed = [...new Set(removedOriginalIndexes)].sort((a, b) => a - b);
  const insertedBeforeSurvivors = options.insertedBeforeSurvivors ?? 0;
  if (!Number.isSafeInteger(insertedBeforeSurvivors) || insertedBeforeSurvivors < 0) {
    throw new Error('deck binding rebase requires a non-negative insertion count');
  }
  const relocated = new Map<number, number>();
  const relocatedNewIndexes = new Set<number>();
  for (const entry of options.relocatedOccurrences ?? []) {
    if (!removed.includes(entry.originalIndex)
      || !Number.isSafeInteger(entry.newIndex)
      || entry.newIndex < 0
      || entry.newIndex >= state.players[player].deck.length
      || relocated.has(entry.originalIndex)
      || relocatedNewIndexes.has(entry.newIndex)) {
      throw new Error('deck binding rebase requires unique live relocation indexes');
    }
    relocated.set(entry.originalIndex, entry.newIndex);
    relocatedNewIndexes.add(entry.newIndex);
  }
  const witness = cardOccurrenceWitness(state, player, 'deck');
  const preserveRemoved = new Set(options.preserveRemovedBindingKeysAsResolved ?? []);
  for (const bindKey of Object.keys(bindings)) {
    const binding = bindings[bindKey];
    if (!Array.isArray(binding)) continue;
    bindings[bindKey] = binding.flatMap<unknown>((value) => {
      if (value === null || typeof value !== 'object') return [value];
      const candidate = value as Candidate;
      if (candidate.kind !== 'card'
        || candidate.area !== 'deck'
        || candidate.player !== player
        || typeof candidate.index !== 'number') return [value];
      const wasCanonical = candidate.occurrenceWitness === previousWitness
        && candidate.uid === cardOccurrenceUid(player, 'deck', candidate.cardId, candidate.index);
      if (!wasCanonical) return [value];
      const relocatedIndex = relocated.get(candidate.index);
      if (removed.includes(candidate.index) && relocatedIndex === undefined) {
        if (!preserveRemoved.has(bindKey)) return [];
        const {
          uid: _uid,
          index: _index,
          occurrenceWitness: _occurrenceWitness,
          ...resolved
        } = candidate;
        return [{ ...resolved, area: 'resolved' }];
      }
      const index = relocatedIndex ?? (insertedBeforeSurvivors
        + candidate.index
        - removed.filter(removedIndex => removedIndex < candidate.index!).length);
      if (state.players[player].deck[index] !== candidate.cardId) return [value];
      return [{
        ...candidate,
        uid: cardOccurrenceUid(player, 'deck', candidate.cardId, index),
        index,
        occurrenceWitness: witness,
      }];
    });
  }
}

/**
 * Pair final deck placements with the exact pre-mutation occurrences.
 * Duplicate card IDs use their original occurrence order, never indexOf.
 */
export function deckOccurrenceRelocations(
  occurrences: readonly DeckOccurrencePlacement[],
  placements: readonly DeckOccurrencePlacement[],
): Array<{ originalIndex: number; newIndex: number }> {
  const available = new Map<string, DeckOccurrencePlacement[]>();
  for (const occurrence of occurrences) {
    const queue = available.get(occurrence.cardId) ?? [];
    queue.push(occurrence);
    available.set(occurrence.cardId, queue);
  }
  const relocated = placements.map((placement) => {
    const original = available.get(placement.cardId)?.shift();
    if (!original) throw new Error('deck relocation card multiset mismatch');
    return { originalIndex: original.index, newIndex: placement.index };
  });
  if ([...available.values()].some(queue => queue.length > 0)) {
    throw new Error('deck relocation card multiset mismatch');
  }
  return relocated;
}
