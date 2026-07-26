// CT-P10 B10081/B10097: dynamic level bounds must read the bound card in its
// current area. Hand continuous level effects apply after a move to hand;
// stale character bindings never fall back to printed level.
import { beforeEach, describe, expect, it } from 'vitest';
import { candidates } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { register, _resetRegistry } from '@/engine/read/def';
import '@/engine/read/char';
import '@/engine/flow/main/hand-use-card';
import type { CardDef, EffectCtx } from '@/engine/types';

const handLevelFour: CardDef = {
  id: 'DYN_HAND', no: 'DYN_HAND', kind: 'character', names: ['手札レベル4'], colors: ['青'], level: 8, ap: 1000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-hand', continuousModifier: { lvlOverrideInHand: 4 }, text: '', ruleRefs: [] }],
} as CardDef;
const levelThree: CardDef = { id: 'LV3', no: 'LV3', kind: 'character', names: ['Lv3'], colors: ['青'], level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const levelFour: CardDef = { id: 'LV4', no: 'LV4', kind: 'character', names: ['Lv4'], colors: ['青'], level: 4, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const levelEight: CardDef = { id: 'LV8', no: 'LV8', kind: 'character', names: ['Lv8'], colors: ['青'], level: 8, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function ctx(bindings: EffectCtx['bindings']): EffectCtx {
  return { source: { player: 'self', cardId: 'DYN_HAND', area: 'hand' }, bindings };
}

beforeEach(() => {
  _resetRegistry();
  register(handLevelFour); register(levelThree); register(levelFour); register(levelEight);
});

describe('CT-P10 effective bound levels', () => {
  it('uses the moved hand card effective level for levelMinBound target candidates', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['DYN_HAND'];
    const low = mutate.scene.enter(state, 'self', 'LV3', {});
    const equal = mutate.scene.enter(state, 'self', 'LV4', {});
    const high = mutate.scene.enter(state, 'self', 'LV8', {});
    const bound = { $moved: [{ cardId: 'DYN_HAND', area: 'hand', player: 'self', index: 0 }] };

    const got = candidates(state, {
      kind: 'pick',
      query: { area: 'scene', side: 'self', filter: { levelMinBound: { bindKey: '$moved' } } },
    }, ctx(bound)).map(c => c.uid);

    expect(got).toEqual([equal.uid, high.uid]);
    expect(got).not.toContain(low.uid);
  });

  it('uses effective hand level for boundMatchesFilter after deck-to-hand movement', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['DYN_HAND'];
    const moved = { $added: [{ cardId: 'DYN_HAND', area: 'hand', player: 'self', index: 0 }] };

    // B10097 form: printed Lv8 must not satisfy "Lv5以上" once its on-hand
    // continuous effect makes it Lv4.
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: '$added', filter: { levelMin: 5 } }, ctx(moved))).toBe(false);
  });

  it('fails closed for declined or stale post-move hand bindings, even when the same card remains in hand', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['LV3', 'DYN_HAND'];
    const ref = { kind: 'pick' as const, query: { area: 'scene' as const, side: 'self' as const, filter: { levelMinBound: { bindKey: '$moved' } } } };
    mutate.scene.enter(state, 'self', 'LV4', {});

    expect(candidates(state, ref, ctx({ $moved: [] }))).toEqual([]);
    // The cardId exists at index 1, but index 0 identifies a stale moved occurrence.
    expect(candidates(state, ref, ctx({ $moved: [{ cardId: 'DYN_HAND', area: 'hand', player: 'self', index: 0 }] }))).toEqual([]);
  });

  it('fails closed when a bound character uid has left play', () => {
    const state = createEmptyGameState();
    const target = mutate.scene.enter(state, 'self', 'LV8', {});
    const stale = { $selected: [{ uid: 'gone', cardId: 'DYN_HAND', player: 'self' }] };

    expect(candidates(state, {
      kind: 'pick',
      query: { area: 'scene', side: 'self', filter: { levelMaxBound: { bindKey: '$selected' } } },
    }, ctx(stale)).map(c => c.uid)).not.toContain(target.uid);
  });
});
