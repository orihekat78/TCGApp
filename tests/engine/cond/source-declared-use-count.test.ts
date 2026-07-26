import { describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Condition, EffectCtx, GameState, SceneCharacter } from '@/engine/types';

function stateWithUses(uses: Record<string, number>): GameState {
  const state = createEmptyGameState();
  state.players.self.scene = [{
    cardId: 'SOURCE', uid: 'source', state: 'active', isNamed: false,
    enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: [],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: uses,
  } as SceneCharacter];
  return state;
}

const sourceCtx: EffectCtx = {
  source: { cardId: 'SOURCE', uid: 'source', abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
};

describe('sourceDeclaredUseCount condition', () => {
  it('reads the runtime source uid and ability id with eq and ge comparisons', () => {
    const state = stateWithUses({ a1: 3, a2: 9 });
    const eq3 = { kind: 'sourceDeclaredUseCount', cmp: 'eq', n: 3 } as unknown as Condition;
    const ge3 = { kind: 'sourceDeclaredUseCount', cmp: 'ge', n: 3 } as unknown as Condition;
    const ge4 = { kind: 'sourceDeclaredUseCount', cmp: 'ge', n: 4 } as unknown as Condition;

    expect(evalCond(state, eq3, sourceCtx)).toBe(true);
    expect(evalCond(state, ge3, sourceCtx)).toBe(true);
    expect(evalCond(state, ge4, sourceCtx)).toBe(false);
    expect(JSON.parse(JSON.stringify(eq3))).toEqual(eq3);
  });

  it('keeps declaredUseUnder compatible for explicitly addressed counts', () => {
    const state = stateWithUses({ a1: 3 });
    expect(evalCond(state, { kind: 'declaredUseUnder', uid: 'source', abilityId: 'a1', max: 4 }, sourceCtx)).toBe(true);
    expect(evalCond(state, { kind: 'declaredUseUnder', uid: 'source', abilityId: 'a1', max: 3 }, sourceCtx)).toBe(false);
  });
});
