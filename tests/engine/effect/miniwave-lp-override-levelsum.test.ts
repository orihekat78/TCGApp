// engine mini-wave (2026-07-10): lpOverride_turn + $bound.<key>.levelSum
// rules: 19-special-rules.md (元のLP/APをXにする = base 差替、修整±は残る) / 11 (LP≤0 推理0枚)
// 解禁 consumer: B01045/B01054/B09011 (ターン終了時まで元のLPをX) / B04063 (bound 集合レベル合計)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { read } from '@/engine/read';
import { runAtom } from '@/engine/effect/atom-handlers';
import { evalDyn } from '@/engine/dyn/eval';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

const CHAR5: CardDef = { id: 'CHAR5', no: 'CHAR5', kind: 'character', names: ['五'], colors: ['赤'], level: 5, ap: 5000, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const CHAR7: CardDef = { id: 'CHAR7', no: 'CHAR7', kind: 'character', names: ['七'], colors: ['赤'], level: 7, ap: 7000, lp: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState, uid: string): EffectCtx {
  return { source: { player: 'self', uid, cardId: s.players.self.scene.find((c) => c.uid === uid)!.cardId }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(CHAR5);
  registerCardDef(CHAR7);
});

describe('charOverrideLP scope:turn — turnEffects lpOverride_turn (miniwave)', () => {
  it('base 差替 + 修整合算残存 + clearTurnEffects(turn) で復元', () => {
    const s = base();
    const c = mutate.scene.enter(s, 'self', 'CHAR5', {});
    expect(read.char.lp(s, c.uid)).toBe(3);
    runAtom(s, 'charOverrideLP' as never, { uid: c.uid, val: 0, scope: 'turn' }, ctxFor(s, c.uid));
    expect(read.char.lp(s, c.uid), '元のLPを0 (base 差替)').toBe(0);
    mutate.char.modifyLP(s, c.uid, 2, 'turn');
    expect(read.char.lp(s, c.uid), 'override 0 + 修整 +2 (rules/19 QA)').toBe(2);
    mutate.char.clearTurnEffects(s, c.uid, 'turn');
    expect(read.char.lp(s, c.uid), 'ターン終了で印字値へ復元').toBe(3);
  });
  it('turn-override は恒久 lpOverride より優先 (後発効果勝ち)、清掃後は恒久が残る', () => {
    const s = base();
    const c = mutate.scene.enter(s, 'self', 'CHAR5', {});
    runAtom(s, 'charOverrideLP' as never, { uid: c.uid, val: 1 }, ctxFor(s, c.uid)); // 恒久
    runAtom(s, 'charOverrideLP' as never, { uid: c.uid, val: 0, scope: 'turn' }, ctxFor(s, c.uid));
    expect(read.char.lp(s, c.uid), 'turn 優先').toBe(0);
    mutate.char.clearTurnEffects(s, c.uid, 'turn');
    expect(read.char.lp(s, c.uid), '恒久 override は残る').toBe(1);
  });
});

describe('$bound.<key>.levelSum (miniwave)', () => {
  it('bound 集合 (cardId) のレベル合計', () => {
    const s = base();
    const ctx = ctxFor(s, mutate.scene.enter(s, 'self', 'CHAR5', {}).uid);
    (ctx.bindings as Record<string, unknown>)['$removed'] = [{ cardId: 'CHAR5' }, { cardId: 'CHAR7' }];
    expect(evalDyn(s, '$bound.$removed.levelSum', ctx)).toBe(12);
  });
  it('uid 要素は実効レベル (scene) で合算、空 bound は 0', () => {
    const s = base();
    const c5 = mutate.scene.enter(s, 'self', 'CHAR5', {});
    const ctx = ctxFor(s, c5.uid);
    (ctx.bindings as Record<string, unknown>)['$mix'] = [{ uid: c5.uid }, { cardId: 'CHAR7' }];
    expect(evalDyn(s, '$bound.$mix.levelSum', ctx)).toBe(12);
    (ctx.bindings as Record<string, unknown>)['$empty'] = [];
    expect(evalDyn(s, '$bound.$empty.levelSum', ctx)).toBe(0);
  });
});
