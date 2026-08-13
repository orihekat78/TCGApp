import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B06095 } from '@/cards/ct-p06/B06095';
import { B06095P } from '@/cards/ct-p06/B06095P';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { endTurn } from '@/engine/flow/turn';
import { runAllUntilEmpty } from '@/engine/resolve';
import { mutate } from '@/engine/mutate';
import { candidates, effectiveTraitNames } from '@/engine/target/candidates';
import { targetFilterToPredicateWithCtx } from '@/engine/effect/atom-handlers/_shared';
import { evalCond } from '@/engine/cond/eval';
import { cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import type { CardDef, Candidate, EffectCtx, GameState } from '@/engine/types';

const TRAIT = '喫茶ポアロ';
const CHAR = 'B06095_TEST_CHAR';
const OTHER = 'B06095_TEST_OTHER';
const PARTNER = 'B06095_TEST_PARTNER';

const character = (id: string): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 3,
  ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});
const partner: CardDef = {
  id: PARTNER, no: PARTNER, kind: 'partner', names: [PARTNER], colors: ['黄'],
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

const ctx: EffectCtx = { source: { player: 'self', area: 'case', uid: 'case:self', cardId: 'B06095' }, bindings: {} };
const cardCand = (area: 'hand' | 'deck' | 'remove' | 'partner-area' | 'case', player: 'self' | 'opp' = 'self'): Candidate =>
  ({ kind: 'card', cardId: CHAR, area, player, index: 0 });

function base(side: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players[side];
  p.case.cardId = 'B06095';
  p.case.status = '解決編';
  p.case.colors = ['黄'];
  p.partner.cardId = PARTNER;
  p.partnerAreaCards = [CHAR];
  p.hand = [CHAR];
  p.deck = [CHAR];
  p.remove = [CHAR];
  p.evidence = [{ cardId: CHAR, faceUp: false, origin: { turn: 1, via: 'opening' } }, { cardId: OTHER, faceUp: false, origin: { turn: 1, via: 'opening' } }];
  p.file = [{ type: 'card-back', cardId: CHAR, faceUp: false }];
  mutate.scene.enter(s, side, CHAR, {});
  return s;
}

function activate(s0: GameState, side: 'self' | 'opp' = 'self'): GameState {
  return produce(s0, s => {
    activateDeclaredAbility(s, side === 'self' ? 'case:self' : 'case:opp', 'a2', { flipFaceUpEvidence: { indices: [0, 1] } });
    runAllUntilEmpty(s);
  });
}

beforeEach(() => {
  resetDefRegistry();
  [B06095, B06095P, character(CHAR), character(OTHER), partner].forEach(registerCardDef);
});

describe('B06095/B06095P all-area character trait grant', () => {
  it('production dispatch grants the trait to self character cards in all eight areas, but not partner/case', () => {
    const s = activate(base());
    const scene = s.players.self.scene[0];
    expect(effectiveTraitNames(s, CHAR, scene, { kind: 'char', uid: scene.uid, cardId: CHAR, player: 'self' })).toContain(TRAIT);
    for (const area of ['hand', 'deck', 'remove', 'partner-area'] as const) {
      expect(effectiveTraitNames(s, CHAR, null, cardCand(area)), area).toContain(TRAIT);
    }
    expect(effectiveTraitNames(s, CHAR, null, { kind: 'evidence', player: 'self', index: 0 })).toContain(TRAIT);
    expect(effectiveTraitNames(s, CHAR, null, { kind: 'file', player: 'self', index: 0 })).toContain(TRAIT);
    expect(effectiveTraitNames(s, 'B06095', null, cardCand('case'))).not.toContain(TRAIT);
    expect(effectiveTraitNames(s, PARTNER, null, { kind: 'partner', player: 'self' })).not.toContain(TRAIT);
  });

  it('is owner-oriented, covers a character entering or moving after activation, and expires at turn end', () => {
    const s = activate(base('opp'), 'opp');
    expect(effectiveTraitNames(s, CHAR, null, cardCand('hand', 'opp'))).toContain(TRAIT);
    expect(effectiveTraitNames(s, CHAR, null, cardCand('hand', 'self'))).not.toContain(TRAIT);
    const moved = produce(s, d => {
      d.players.opp.remove.splice(0, 0, CHAR);
      mutate.scene.enter(d, 'opp', CHAR, {});
    });
    const entered = moved.players.opp.scene.at(-1)!;
    expect(effectiveTraitNames(moved, CHAR, entered, { kind: 'char', uid: entered.uid, cardId: CHAR, player: 'opp' })).toContain(TRAIT);
    const expired = produce(moved, d => endTurn(d, 'opp'));
    expect(effectiveTraitNames(expired, CHAR, null, cardCand('remove', 'opp'))).not.toContain(TRAIT);
  });

  it('does not make a face-down FILE card targetable by its newly granted trait', () => {
    const s = activate(base());
    const found = candidates(s, { kind: 'pick', query: { area: 'file', side: 'self', filter: { trait: TRAIT } } }, ctx);
    expect(found).toEqual([]);
  });

  it('does not expose face-down evidence through a trait filter, while retaining matching face-up evidence', () => {
    const s0 = base();
    s0.players.self.evidence.push({ cardId: CHAR, faceUp: false, origin: { turn: 1, via: 'opening' } });
    const s = activate(s0);
    const found = candidates(s, { kind: 'pick', query: { area: 'evidence', side: 'self', filter: { trait: TRAIT } } }, ctx);
    expect(found).toEqual([
      { kind: 'evidence', player: 'self', index: 0, occurrenceWitness: cardOccurrenceWitness(s, 'self', 'evidence') },
      { kind: 'evidence', player: 'self', index: 1, occurrenceWitness: cardOccurrenceWitness(s, 'self', 'evidence') },
    ]);
  });

  it('routes deck, remove, and evidence trait predicates through the all-area resolver', () => {
    const s = activate(base());
    expect(targetFilterToPredicateWithCtx(s, { trait: TRAIT }, ctx, 'self')(CHAR)).toBe(true);
    expect(evalCond(s, { kind: 'removeTraitAtLeast', player: 'self', trait: TRAIT, n: 1 }, ctx)).toBe(true);
    expect(evalCond(s, { kind: 'evidenceTraitAtLeast', player: 'self', trait: TRAIT, n: 1 }, ctx)).toBe(true);
    const expired = produce(s, d => endTurn(d, 'self'));
    expect(targetFilterToPredicateWithCtx(expired, { trait: TRAIT }, ctx, 'self')(CHAR)).toBe(false);
    expect(evalCond(expired, { kind: 'removeTraitAtLeast', player: 'self', trait: TRAIT, n: 1 }, ctx)).toBe(false);
    expect(evalCond(expired, { kind: 'evidenceTraitAtLeast', player: 'self', trait: TRAIT, n: 1 }, ctx)).toBe(false);
  });

  it('has base/P equivalent ability text and exact two-face-down-evidence cost', () => {
    expect(B06095.abilities).toEqual(B06095P.abilities);
    expect(B06095P.abilities).not.toBe(B06095.abilities);
    expect(B06095P.abilities[0]).not.toBe(B06095.abilities[0]);
    const a2 = B06095.abilities.find(a => a.id === 'a2')!;
    expect(a2.cost).toEqual({ kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } });
  });
});
