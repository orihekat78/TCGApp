// B04055 engine primitive: a deck-reveal filter may compare the revealed
// card's printed traits with the removed character snapshot in triggerPayload.
// rules: 15-abilities-effects; B04055 official Q&A
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAtom } from '@/engine/effect/atom-handlers';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const HOST: CardDef = {
  id: 'HOST', no: 'HOST', kind: 'character', names: ['HOST'], colors: ['赤'],
  level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const DECOY: CardDef = {
  id: 'DECOY', no: 'DECOY', kind: 'character', names: ['DECOY'], colors: ['青'],
  level: 1, ap: 1000, lp: 1, traits: ['警察'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const MATCH: CardDef = {
  id: 'MATCH', no: 'MATCH', kind: 'character', names: ['MATCH'], colors: ['黄'],
  level: 1, ap: 1000, lp: 1, traits: ['FBI', '探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const VICTIM: CardDef = {
  id: 'VICTIM', no: 'VICTIM', kind: 'character', names: ['VICTIM'], colors: ['赤'],
  level: 1, ap: 1000, lp: 1, traits: ['FBI'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const SPLIT: CardDef = { ...VICTIM, id: 'SPLIT', names: ['A&B', 'A', 'B'] };
const NAME_MATCH: CardDef = { ...MATCH, id: 'NAME_MATCH', names: ['B'] };

function state(): GameState {
  const s = createEmptyGameState();
  s.players.self.deck = ['DECOY', 'MATCH'];
  return s;
}

function ctx(): EffectCtx {
  return {
    source: { player: 'self', uid: 'host', cardId: 'HOST' },
    bindings: {},
    triggerPayload: { removedChar: { uid: 'victim', cardId: 'VICTIM', state: 'active', turnEffects: {} } },
  } as unknown as EffectCtx;
}

beforeEach(() => {
  resetDefRegistry();
  for (const d of [HOST, DECOY, MATCH, VICTIM, SPLIT, NAME_MATCH]) registerCardDef(d);
});

describe('B04055 trigger-removed trait reveal filter', () => {
  it('top1 only: ignores a non-sharing decoy and leaves $matched empty', () => {
    const s = state();
    const effectCtx = ctx();
    runAtom(s, 'deckRevealUntil' as never, {
      player: 'self', maxN: 1, bind: '$revealed', bindMatch: '$matched',
      filter: { traitSharedWithTriggerRemoved: true },
    }, effectCtx);

    expect((effectCtx.bindings['$matched'] ?? [])).toEqual([]);
    expect((effectCtx.bindings['$revealed'] ?? []).map(c => c.cardId)).toEqual(['DECOY']);
  });

  it('matches when any printed trait overlaps the removed snapshot', () => {
    const s = state();
    s.players.self.deck = ['MATCH'];
    const effectCtx = ctx();
    runAtom(s, 'deckRevealUntil' as never, {
      player: 'self', maxN: 1, bind: '$revealed', bindMatch: '$matched',
      filter: { traitSharedWithTriggerRemoved: true },
    }, effectCtx);

    expect((effectCtx.bindings['$matched'] ?? []).map(c => c.cardId)).toEqual(['MATCH']);
  });

  it('fails closed without a removed-character snapshot', () => {
    const s = state();
    const effectCtx = { ...ctx(), triggerPayload: {} } as EffectCtx;
    runAtom(s, 'deckRevealUntil' as never, {
      player: 'self', maxN: 1, bind: '$revealed', bindMatch: '$matched',
      filter: { traitSharedWithTriggerRemoved: true },
    }, effectCtx);

    expect((effectCtx.bindings['$matched'] ?? [])).toEqual([]);
  });

  it('matches any split name from the sceneRemove bound snapshot and fails closed when stale/missing', () => {
    const s = state(); s.players.self.deck = ['DECOY', 'NAME_MATCH'];
    const effectCtx = { ...ctx(), bindings: { '$removed': [{ cardId: 'SPLIT', snapCardNames: ['A&B', 'A', 'B'] }] } } as EffectCtx;
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 10, bind: '$revealed', bindMatch: '$matched', filter: { cardNameAnyBound: '$removed' } }, effectCtx);
    expect((effectCtx.bindings['$matched'] ?? []).map(c => c.cardId)).toEqual(['NAME_MATCH']);
    const missing = { ...ctx(), bindings: { '$removed': [] } } as EffectCtx;
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 1, bindMatch: '$matched', filter: { cardNameAnyBound: '$removed' } }, missing);
    expect(missing.bindings['$matched']).toEqual([]);
  });

  it('stopAtFirstMatch keeps later deck cards outside the revealed bound window', () => {
    const s = state(); s.players.self.deck = ['DECOY', 'NAME_MATCH', 'MATCH'];
    const effectCtx = { ...ctx(), bindings: { '$removed': [{ cardId: 'SPLIT', snapCardNames: ['A&B', 'A', 'B'] }] } } as EffectCtx;
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 10, stopAtFirstMatch: true, bind: '$revealed', bindMatch: '$matched', filter: { cardNameAnyBound: '$removed' } }, effectCtx);
    expect((effectCtx.bindings['$revealed'] ?? []).map(c => c.cardId)).toEqual(['DECOY']);
    expect((effectCtx.bindings['$matched'] ?? []).map(c => c.cardId)).toEqual(['NAME_MATCH']);
  });
});
