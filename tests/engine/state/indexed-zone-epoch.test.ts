import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { runAtom } from '@/engine/effect/atom-handlers';
import { deckOccurrenceAuthority } from '@/engine/effect/deck-occurrence-authority';
import {
  advanceIndexedZoneEpoch,
  indexedZoneEpoch,
} from '@/engine/state/indexed-zone-epoch';
import {
  cardOccurrenceWitness,
  isLiveCardOccurrenceWitness,
} from '@/engine/target/card-occurrence';
import { makeChar, makeCtx } from '../../helpers/fixtures';

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
      self: { deck: 0, evidence: 0, remove: 0 },
      opp: { deck: 0, evidence: 0, remove: 0 },
    });
    expect(isLiveCardOccurrenceWitness(state, 'self', 'evidence', '["SECRET"]')).toBe(false);
    expect(isLiveCardOccurrenceWitness(state, 'self', 'evidence', 'occ:v1:self:evidence:9007199254740992')).toBe(false);
    expect(() => advanceIndexedZoneEpoch({
      ...createEmptyGameState(),
      indexedZoneEpochs: { self: { deck: 0, evidence: Number.MAX_SAFE_INTEGER, remove: 0 }, opp: { deck: 0, evidence: 0, remove: 0 } },
    }, 'self', 'evidence')).toThrow(/overflow/i);
  });

  it('migrates an exact legacy evidence/remove epoch shape with a zero deck epoch', () => {
    const state = createEmptyGameState();
    state.indexedZoneEpochs = {
      self: { evidence: 3, remove: 4 },
      opp: { evidence: 5, remove: 6 },
    } as typeof state.indexedZoneEpochs;

    expect(cardOccurrenceWitness(state, 'self', 'deck')).toBe('occ:v1:self:deck:0');
    expect(state.indexedZoneEpochs).toEqual({
      self: { deck: 0, evidence: 3, remove: 4 },
      opp: { deck: 0, evidence: 5, remove: 6 },
    });
  });

  it('refuses to mint deck authority with a stale or malformed supplied witness', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A'];
    const staleWitness = cardOccurrenceWitness(state, 'self', 'deck');
    advanceIndexedZoneEpoch(state, 'self', 'deck');

    expect(deckOccurrenceAuthority(state, 'self', 0, staleWitness)).toBeNull();
    expect(deckOccurrenceAuthority(state, 'self', 0, '')).toBeNull();
    expect(deckOccurrenceAuthority(state, 'self', 0, 'occ:v1:opp:deck:1')).toBeNull();
    expect(deckOccurrenceAuthority(state, 'self', 0)).toMatchObject({
      uid: 'card:self:deck:A#0',
      occurrenceWitness: 'occ:v1:self:deck:1',
    });
  });

  it('keeps deck reads stable and invalidates deck witnesses for every public deck mutator', () => {
    const expectInvalidated = (change: (state: ReturnType<typeof createEmptyGameState>) => void) => {
      const state = createEmptyGameState();
      state.players.self.deck = ['A', 'B'];
      const witness = cardOccurrenceWitness(state, 'self', 'deck');
      change(state);
      expect(isLiveCardOccurrenceWitness(state, 'self', 'deck', witness)).toBe(false);
    };

    const readOnly = createEmptyGameState();
    readOnly.players.self.deck = ['A', 'B'];
    const readWitness = cardOccurrenceWitness(readOnly, 'self', 'deck');
    expect(mutate.deck.peek(readOnly, 'self', 2)).toEqual(['A', 'B']);
    expect(mutate.deck.reveal(readOnly, 'self', 2)).toEqual(['A', 'B']);
    expect(isLiveCardOccurrenceWitness(readOnly, 'self', 'deck', readWitness)).toBe(true);

    expectInvalidated(state => { mutate.deck.draw(state, 'self', 1); });
    expectInvalidated(state => { mutate.deck.toBottom(state, 'self', ['C']); });
    expectInvalidated(state => { mutate.deck.toTop(state, 'self', ['C']); });
    expectInvalidated(state => { mutate.deck.removeFromTop(state, 'self', 1); });
    expectInvalidated(state => { mutate.deck.shuffle(state, 'self', () => 0.999999); });
  });

  it('invalidates deck witnesses for every cross-zone mutate primitive that changes deck identity', () => {
    const expectInvalidated = (
      setup: (state: ReturnType<typeof createEmptyGameState>) => void,
      change: (state: ReturnType<typeof createEmptyGameState>) => void,
    ) => {
      const state = createEmptyGameState();
      state.players.self.deck = ['A', 'B'];
      setup(state);
      const witness = cardOccurrenceWitness(state, 'self', 'deck');
      change(state);
      expect(isLiveCardOccurrenceWitness(state, 'self', 'deck', witness)).toBe(false);
    };

    expectInvalidated(
      () => {},
      state => { mutate.evidence.addFromDeck(state, 'self', 1, false, { turn: 1, via: 'reasoning' }); },
    );
    expectInvalidated(
      state => { state.players.self.evidence.push({ cardId: 'E', faceUp: false, origin: { turn: 1, via: 'reasoning' } }); },
      state => { mutate.evidence.toDeckTop(state, 'self', 1); },
    );
    expectInvalidated(
      () => {},
      state => { mutate.file.addFromDeckTop(state, 'self', 1); },
    );
    expectInvalidated(
      state => { state.players.self.hand.push('H'); },
      state => { mutate.hand.toDeckBottom(state, 'self', ['H']); },
    );
    expectInvalidated(
      state => { mutate.scene.enter(state, 'self', 'CHAR-A', { active: true }); },
      state => { mutate.scene.toDeck(state, state.players.self.scene[0]!.uid, 'top'); },
    );
    expectInvalidated(
      state => { mutate.scene.enter(state, 'self', 'CHAR-B', { active: true }); },
      state => { mutate.scene.toDeckBottom(state, state.players.self.scene[0]!.uid); },
    );
  });

  it('invalidates deck witnesses for every atom writer that bypasses public deck mutators', () => {
    const expectInvalidated = (
      setup: (state: ReturnType<typeof createEmptyGameState>) => void,
      change: (state: ReturnType<typeof createEmptyGameState>) => void,
    ) => {
      const state = createEmptyGameState();
      state.players.self.deck = ['A', 'B'];
      setup(state);
      const witness = cardOccurrenceWitness(state, 'self', 'deck');
      change(state);
      expect(isLiveCardOccurrenceWitness(state, 'self', 'deck', witness)).toBe(false);
    };

    expectInvalidated(
      state => { state.players.self.hand = ['H']; },
      state => { runAtom(state, 'handToDeckBottom', { player: 'self', target: ['H'] }, makeCtx()); },
    );
    expectInvalidated(
      () => {},
      state => { runAtom(state, 'handAddFromDeckBottom', { player: 'self' }, makeCtx()); },
    );
    expectInvalidated(
      state => { state.players.self.scene = [makeChar({ uid: 'host' })]; },
      state => { runAtom(state, 'charSetCard', { uid: 'host', player: 'self', fromDeckTop: true }, makeCtx()); },
    );
    expectInvalidated(
      () => {},
      state => {
        runAtom(state, 'sceneEnter', {
          player: 'self',
          cardId: 'A',
          target: { query: { area: 'deck', side: 'self' } },
          sourceRequired: true,
        }, makeCtx());
      },
    );
    expectInvalidated(
      () => {},
      state => {
        const occurrence = deckOccurrenceAuthority(state, 'self', 0);
        expect(occurrence).not.toBeNull();
        runAtom(state, 'boundToRemove', { player: 'self', bindKey: 'r' }, makeCtx({
          bindings: { r: [occurrence!] },
        }));
      },
    );
  });
});
