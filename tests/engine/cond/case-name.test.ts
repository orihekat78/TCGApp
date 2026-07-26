import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const exactCase: CardDef = {
  id: 'CASE_EXACT', no: 'x/CASE_EXACT', kind: 'case', names: ['工藤新一NYの事件'], colors: ['青'],
  traits: [], rarity: 'C', imageUrl: '', caseLevel: 7, abilities: [], ruleRefs: [],
};
const splitNameCase: CardDef = {
  id: 'CASE_SPLIT', no: 'x/CASE_SPLIT', kind: 'case', names: ['工藤新一', 'NYの事件'], colors: ['青'],
  traits: [], rarity: 'C', imageUrl: '', caseLevel: 7, abilities: [], ruleRefs: [],
};

function context(): EffectCtx {
  return { source: { player: 'self', cardId: 'SOURCE', uid: 'source', abilityId: 'a1', area: 'hand' }, bindings: {} } as EffectCtx;
}

function state(caseId = ''): GameState {
  const value = createEmptyGameState();
  value.players.self.case.cardId = caseId;
  value.players.self.case.colors = ['青'];
  return value;
}

beforeEach(() => {
  _resetRegistry();
  register(exactCase); register(splitNameCase);
});

describe('caseName condition', () => {
  it('matches only an exact official case-name component in either case status', () => {
    const condition = { kind: 'caseName', name: '工藤新一NYの事件' } as const;
    for (const status of ['事件編', '解決編'] as const) {
      const value = state('CASE_EXACT');
      value.players.self.case.status = status;
      expect(evalCond(value, condition, context())).toBe(true);
    }
  });

  it('fails closed for no case and does not compose split name components', () => {
    const condition = { kind: 'caseName', name: '工藤新一NYの事件' } as const;
    expect(evalCond(state(), condition, context())).toBe(false);
    expect(evalCond(state('CASE_SPLIT'), condition, context())).toBe(false);
  });
});
