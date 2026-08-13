import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  advanceIndexedZoneEpoch,
  indexedZoneEpoch,
} from '@/engine/state/indexed-zone-epoch';
import {
  cardOccurrenceWitness,
  isLiveCardOccurrenceWitness,
} from '@/engine/target/card-occurrence';

describe('indexed-zone epochs', () => {
  it('creates opaque versioned witnesses and invalidates them after a zone revision', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];

    const witness = cardOccurrenceWitness(state, 'self', 'remove');

    expect(witness).toBe('occ:v1:self:remove:0');
    expect(witness).not.toContain('DUP');
    expect(isLiveCardOccurrenceWitness(state, 'self', 'remove', witness)).toBe(true);

    advanceIndexedZoneEpoch(state, 'self', 'remove');

    expect(indexedZoneEpoch(state, 'self', 'remove')).toBe(1);
    expect(isLiveCardOccurrenceWitness(state, 'self', 'remove', witness)).toBe(false);
  });

  it('fails closed for legacy state and malformed or overflowed witnesses', () => {
    const state = createEmptyGameState();
    delete state.indexedZoneEpochs;

    expect(cardOccurrenceWitness(state, 'self', 'evidence')).toBe('occ:v1:self:evidence:0');
    expect(state.indexedZoneEpochs).toEqual({
      self: { evidence: 0, remove: 0 },
      opp: { evidence: 0, remove: 0 },
    });
    expect(isLiveCardOccurrenceWitness(state, 'self', 'evidence', '["SECRET"]')).toBe(false);
    expect(isLiveCardOccurrenceWitness(state, 'self', 'evidence', 'occ:v1:self:evidence:9007199254740992')).toBe(false);
    expect(() => advanceIndexedZoneEpoch({
      ...createEmptyGameState(),
      indexedZoneEpochs: { self: { evidence: Number.MAX_SAFE_INTEGER, remove: 0 }, opp: { evidence: 0, remove: 0 } },
    }, 'self', 'evidence')).toThrow(/overflow/i);
  });
});
