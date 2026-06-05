// 2026-06-04 adversarial review (BUG-106〜110 セッション) で確定した latent 修正の回帰テスト。
//   #6: 短縮形/await sceneEnter が現場満杯時に pick modal を出してから skip する UX バグ
//       → modal を出す前に早期 skip する (queue へ push しない)。
//   #5: 同一 ctx の sequence 内で前段 choice の choiceIndex が後続 choice へ leak する
//       → unwrap 後に ctx.dyn.choiceIndex を消す。
//
// rules: 15-abilities-effects.md, 20-color-and-switch.md

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength, _clearPendingEffectChoiceSide, _peekPendingEffectChoiceSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { EffectCtx, SceneCharacter } from '@/engine/types';

function sceneChar(cardId: string, uid: string): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', cardId: 'X', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
}

describe('review-hardening', () => {
  beforeAll(() => registerAll());
  beforeEach(() => {
    _clearPendingEffectPickQueue();
    _clearPendingEffectChoiceSide();
    (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation = [];
  });

  // #6: 短縮形 sceneEnter — 現場満杯なら pick modal (queue push) を出さず即 skip
  it('短縮形 sceneEnter は現場満杯時に pick を queue へ積まず即 skip する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = Array.from({ length: 5 }, (_, i) => sceneChar('D08013', `c${i}`)); // 満杯
    s.players.self.remove = ['D08013']; // 少年探偵団 Lv4 (登場候補)

    runAtom(s, 'sceneEnter', { player: 'self', from: 'remove', max: 1, filterAny: [{ trait: '少年探偵団', levelMax: 5 }], viaEffect: true }, ctxSelf());

    expect(_peekPendingEffectPickQueueLength(), '満杯なので pick modal を出さない (queue 空)').toBe(0);
    expect(s.players.self.scene.length, '登場せず 5 枚のまま').toBe(5);
    expect(s.players.self.remove, '候補はリムーブに残る (消失なし)').toContain('D08013');
  });

  // #5: sequence 内 2 つ目の choice が前段 choiceIndex を leak で誤 unwrap しない
  it('sequence 内の 2 つ目の choice は前段の choiceIndex を引き継がない', () => {
    const s = createEmptyGameState();
    // choice1 (2 option) → choice2 (3 option) の sequence。choiceIndex=1 を指定。
    const eff = {
      kind: 'sequence',
      steps: [
        { kind: 'choice', chooser: 'self', options: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
        ] },
        { kind: 'choice', chooser: 'self', options: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 10 } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 20 } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 30 } },
        ] },
      ],
    };
    const ctx = { source: { player: 'self', cardId: 'X', abilityId: 'a1', area: 'scene' }, bindings: {}, dyn: { choiceIndex: 1 } } as unknown as EffectCtx;
    const r = resolveEffectPicks(s, eff as never, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: 'X', abilityId: 'a1' } }) as { steps: Array<{ kind: string; verb?: string; options?: unknown[] }> };

    // step0: choiceIndex=1 → option1 (draw n:2) に unwrap
    expect(r.steps[0].kind).toBe('atom');
    expect((r.steps[0] as { args?: { n?: number } }).args?.n).toBe(2);
    // step1: 前段 choiceIndex を引き継がない (leak していれば option1 n:20 へ誤 unwrap)。
    // BUG-121: humanChooser + 複数 option + choiceIndex 未指定なので、ここで pause (no-op 空 parallel) し
    //   pendingEffectChoice を surface する (= leak していない確証: index 0 でも 1 でも unwrap せず pause)。
    expect(r.steps[1].kind, '2 つ目の choice は leak した index で unwrap されず pause').toBe('parallel');
    const side = _peekPendingEffectChoiceSide();
    expect(side?.options.length, 'pause した choice2 (3 option) が surface').toBe(3);
  });

  // switch-on-effect-enter (rules/20): 満杯 + switchRemoveUid → 退場キャラ除去して登場 (switchEnter)
  it('現場満杯の効果登場は switchRemoveUid 指定時に既存キャラを退けて登場する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = Array.from({ length: 5 }, (_, i) => sceneChar('D11013', `c${i}`)); // 満杯
    s.players.self.remove = ['D11011']; // reanimate 対象 (萩原千速)

    runAtom(s, 'sceneEnter', {
      player: 'self', cardId: 'D11011', switchRemoveUid: 'c0',
      target: { query: { area: 'remove', side: 'self' } }, viaEffect: true,
    }, ctxSelf());

    expect(s.players.self.scene.length, 'スイッチなので 5 枚維持').toBe(5);
    expect(s.players.self.scene.some((c) => c.cardId === 'D11011'), 'reanimate キャラが登場').toBe(true);
    expect(s.players.self.scene.some((c) => c.uid === 'c0'), '退場キャラ c0 は現場から消える').toBe(false);
    expect(s.players.self.remove, 'reanimate 元はリムーブから抜ける / 退場キャラがリムーブへ').toEqual(['D11013']);
  });

  // 満杯 + switchRemoveUid 無し + AI 経路 → skip (合法な辞退、early guard)
  it('現場満杯 + switchRemoveUid 無し + AI 経路は skip する (カード消失なし)', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; // AI
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = Array.from({ length: 5 }, (_, i) => sceneChar('D11013', `c${i}`));
    s.players.self.remove = ['D11011'];

    runAtom(s, 'sceneEnter', {
      player: 'self', cardId: 'D11011',
      target: { query: { area: 'remove', side: 'self' } }, viaEffect: true,
    }, ctxSelf());

    expect(s.players.self.scene.length, '登場せず 5 枚のまま').toBe(5);
    expect(s.players.self.scene.some((c) => c.cardId === 'D11011'), 'reanimate されない').toBe(false);
    expect(s.players.self.remove, '候補はリムーブに残る (消失なし)').toContain('D11011');
  });
});
