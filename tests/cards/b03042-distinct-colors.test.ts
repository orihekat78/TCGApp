import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { candidates } from '@/engine/target/candidates';
import { resolve } from '@/engine/target/resolve';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { makeCtx } from '../helpers/fixtures';
import type { CardDef, TargetingRef } from '@/engine/types';

const detective = (id: string, colors: string[]): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors, level: 3, ap: 3000, lp: 1,
  traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

const RED = detective('B03042_RED', ['赤']);
const BLUE = detective('B03042_BLUE', ['青']);
const RED_BLUE = detective('B03042_RED_BLUE', ['赤', '青']);

function ref(): TargetingRef {
  return {
    kind: 'pick',
    query: {
      area: 'deck', side: 'self', filter: { kind: 'character', trait: '探偵' },
      distinctColors: true,
    },
    n: { min: 0, max: 2 }, chooser: 'self',
  } as TargetingRef;
}

describe('B03042 distinctColors', () => {
  it('共有する色を持つ2枚を拒否する。複色も全色を占有する', () => {
    _resetRegistry();
    [RED, BLUE, RED_BLUE].forEach(registerCardDef);
    const state = createEmptyGameState();
    state.players.self.deck = [RED.id, BLUE.id, RED_BLUE.id];
    const available = candidates(state, ref(), makeCtx());
    const picked = (ids: string[]) => ids.map(id => available.find(c => c.kind === 'card' && c.cardId === id)!);

    expect(() => resolve(state, ref(), makeCtx(), picked([RED.id, BLUE.id]))).not.toThrow();
    expect(() => resolve(state, ref(), makeCtx(), picked([RED.id, RED_BLUE.id]))).toThrow(/distinctColors/);
    expect(() => resolve(state, ref(), makeCtx(), picked([BLUE.id, RED_BLUE.id]))).toThrow(/distinctColors/);
  });

  it('direct effectPickResolve 相当も共有色を拒否する', () => {
    _resetRegistry();
    [RED, RED_BLUE].forEach(registerCardDef);
    const state = createEmptyGameState();
    state.players.self.deck = [RED.id, RED_BLUE.id];
    const pending = {
      player: 'self' as const, ownerPlayer: 'self' as const,
      candidates: [
        { uid: `${RED.id}#0`, cardId: RED.id, player: 'self' as const },
        { uid: `${RED_BLUE.id}#1`, cardId: RED_BLUE.id, player: 'self' as const },
      ],
      atomVerb: 'handAddFromDeck', atomArgs: { player: 'self', cardIds: '$pick.cardIds' },
      nMin: 0, nMax: 2, source: { cardId: 'B03042', abilityId: 'a1' }, distinctColors: true,
    };
    expect(() => applyPickAndContinuation(state, pending, `${RED.id}#0`, [`${RED.id}#0`, `${RED_BLUE.id}#1`])).toThrow(/distinctColors/);
    expect(state.players.self.deck).toEqual([RED.id, RED_BLUE.id]);
  });
});
