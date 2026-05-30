// BUG-085 Layer 2 end-to-end: caseDeclaredEvidenceFlip の
//   〚裏向き証拠を表向き〛コスト → 表向きにした枚数 × delta だけ対象 AP 修正
// が実際に解決されることを engine レベルで検証する。
//
// 旧バグ: effect の delta `{ dyn: '$cost.flipFaceUpEvidence.count * N' }` が
//   どこでも評価されず ({dyn} オブジェクトのまま modifyAP に渡り AP が NaN 化)、
//   かつ costPaid が effect 解決 ctx に引き継がれていなかった。
//
// rules: 21-declared-ability-cost.md / 15-abilities-effects.md / 19-special-rules.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { pay } from '@/engine/cost/pay';
import * as flow from '@/engine/flow/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { char as readChar } from '@/engine/read/char';
import { caseDeclaredEvidenceFlip } from '@/cards/_shared/caseDeclaredEvidenceFlip';
import type { CardDef, Cost, EffectCtx, GameState } from '@/engine/types';

function makeCaseDef(delta: number): CardDef {
  return {
    id: 'TCASE',
    no: 'TCASE',
    kind: 'case',
    names: ['テスト事件'],
    colors: ['青'],
    traits: [],
    rarity: 'D',
    imageUrl: '',
    caseLevel: 7,
    caseTraits: [],
    abilities: [
      caseDeclaredEvidenceFlip({
        delta,
        targetFilter: { trait: '少年探偵団' },
        side: 'self',
        abilityId: 'a2',
      }),
    ],
    ruleRefs: [],
  } as CardDef;
}

function makeCharDef(): CardDef {
  return {
    id: 'TCHAR',
    no: 'TCHAR',
    kind: 'character',
    names: ['少年探偵A'],
    colors: ['青'],
    level: 1,
    ap: 3000,
    lp: 1,
    traits: ['少年探偵団'],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  } as CardDef;
}

function setup(delta: number, faceDownCount: number): { state: GameState; charUid: string; cost: Cost } {
  registerCardDef(makeCaseDef(delta));
  registerCardDef(makeCharDef());
  const state = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.case = {
      cardId: 'TCASE',
      status: '解決編',
      requiredEvidence: 7,
      colors: ['青'],
      declaredUseCount: {},
    };
    mutate.scene.enter(d, 'self', 'TCHAR', { active: true });
    for (let i = 0; i < faceDownCount; i++) {
      d.players.self.evidence.push({ cardId: `E${i}`, faceUp: false, origin: { turn: 1, via: 'reasoning' } });
    }
  });
  const charUid = state.players.self.scene.find((c) => c.cardId === 'TCHAR')!.uid;
  const cost = makeCaseDef(delta).abilities[0].cost!;
  return { state, charUid, cost };
}

/** UI dispatch (useEngineDispatch.declaredAbility) と同じ pay → useDeclaredAbility → 解決 経路。 */
function runDeclared(state: GameState, cost: Cost, indices: number[]): GameState {
  return produce(state, (d) => {
    const ctx: EffectCtx = {
      source: { cardId: 'TCASE', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
      bindings: {},
      dyn: { costParams: { flipFaceUpEvidence: { indices } } },
    };
    pay(d, cost, ctx);
    flow.useDeclaredAbility(d, 'case:self', 'a2', ctx);
    runAllUntilEmpty(d);
  });
}

beforeEach(() => {
  _resetRegistry();
  _resetUidCounter();
  // AI / heuristic 経路を使う (human-pick deferral を回避) ため human side を null に。
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('caseDeclaredEvidenceFlip end-to-end (BUG-085 Layer 2)', () => {
  it('証拠2枚を表向き → 少年探偵団キャラに AP+2000 (3000 → 5000)', () => {
    const { state, charUid, cost } = setup(1000, 2);
    const after = runDeclared(state, cost, [0, 1]);
    expect(after.players.self.evidence[0].faceUp).toBe(true);
    expect(after.players.self.evidence[1].faceUp).toBe(true);
    // 旧バグでは {dyn} 未評価で NaN になっていた。正しくは 3000 + 2*1000。
    expect(readChar.ap(after, charUid)).toBe(5000);
  });

  it('証拠1枚を表向き → AP+1000 (count に比例)', () => {
    const { state, charUid, cost } = setup(1000, 2);
    const after = runDeclared(state, cost, [0]);
    expect(after.players.self.evidence[0].faceUp).toBe(true);
    expect(after.players.self.evidence[1].faceUp).toBe(false);
    expect(readChar.ap(after, charUid)).toBe(4000);
  });

  it('delta=-1000 (D11021 系): 2枚で AP-2000 (3000 → 1000)', () => {
    const { state, charUid, cost } = setup(-1000, 2);
    const after = runDeclared(state, cost, [0, 1]);
    expect(readChar.ap(after, charUid)).toBe(1000);
  });

  it('AP が NaN にならない (回帰ガード)', () => {
    const { state, charUid, cost } = setup(1000, 1);
    const after = runDeclared(state, cost, [0]);
    expect(Number.isNaN(readChar.ap(after, charUid))).toBe(false);
  });
});
