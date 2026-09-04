import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { REUSE_CARDS } from '@/cards';
import { B10047 } from '@/cards/ct-p10/B10047';
import { canHandUseCard, handUseCard } from '@/engine/flow/main/hand-use-card';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';

const targetCase: CardDef = {
  id: 'CASE_NY', no: 'x/CASE_NY', kind: 'case', names: ['工藤新一NYの事件'], colors: ['青'], traits: [],
  rarity: 'C', imageUrl: '', caseLevel: 7, abilities: [], ruleRefs: [],
};
const otherCase: CardDef = {
  id: 'CASE_OTHER', no: 'x/CASE_OTHER', kind: 'case', names: ['工藤新一の事件'], colors: ['青'], traits: [],
  rarity: 'C', imageUrl: '', caseLevel: 7, abilities: [], ruleRefs: [],
};

beforeEach(() => {
  _resetRegistry();
  [B10047, targetCase, otherCase].forEach(register);
});

function state(caseId = 'CASE_NY', status: '事件編' | '解決編' = '事件編'): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  value.players.self.case = { cardId: caseId, status, requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  value.players.self.hand = ['B10047'];
  value.players.self.file = Array.from({ length: 6 }, (_, index) => ({ type: 'card-back' as const, cardId: `FILE_${index}` }));
  return value;
}

describe('B10047 ラディッシュ・レッドウッド', () => {
  it('keeps official metadata parity', () => {
    expect(B10047).toMatchObject({
      id: 'B10047', no: '1107/B10047', kind: 'character', names: ['ラディッシュ・レッドウッド'], colors: ['白'],
      level: 5, ap: 5000, lp: 1, traits: ['警察', 'NY市警'], rarity: 'C', imageUrl: '1783904138051265.jpg',
    });
  });

  it('ignores case color for normal hand use and Next Hint only under the exact named case', () => {
    for (const status of ['事件編', '解決編'] as const) {
      const legal = state('CASE_NY', status);
      expect(canHandUseCard(legal, 'self', 'B10047')).toBe(true);
      const normal = produce(legal, (draft) => handUseCard(draft, 'self', 'B10047'));
      const nextHint = produce(legal, (draft) => runNextHint(draft, 'self', 'B10047'));
      // qa: card:B10047:18485b08aaf71c37dce1f7952b7f4382610c83a5c07f19db06d8ede4d712d9e5
      expect({
        normal: normal.players.self.scene.map((char) => char.cardId),
        nextHint: nextHint.players.self.scene.map((char) => char.cardId),
      }).toEqual({ normal: ['B10047'], nextHint: ['B10047'] });
    }

    for (const illegal of [state('CASE_OTHER'), state('')]) {
      expect(canHandUseCard(illegal, 'self', 'B10047')).toBe(false);
      expect(() => produce(illegal, (draft) => runNextHint(draft, 'self', 'B10047'))).toThrow(/color violates case/);
    }
  });

  it('preserves the printed enter and opponent-turn leave abilities, including icon-only disguise filtering', () => {
    expect(B10047.abilities).toMatchObject([
      { type: 'continuous', scope: 'on-hand', condition: { kind: 'caseName', name: '工藤新一NYの事件' }, continuousModifier: { colorIgnoreOnHandUse: true } },
      { type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      ] } },
      { type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true }, condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', levelMax: 6, keyword: '変装' } } } },
    ]);
  });

  it('registers exactly one B10047 entry without duplicating any registry ID', () => {
    expect(REUSE_CARDS.filter((card) => card.id === 'B10047')).toEqual([B10047]);
    expect(new Set(REUSE_CARDS.map((card) => card.id)).size).toBe(REUSE_CARDS.length);
  });
});
