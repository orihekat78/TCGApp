// engine-extension #3 (2026-06-05): multi-target Pattern A pick
//   pickedUids 配列で複数 uid が選ばれた場合、apply-pick.ts が各 uid に per-char atom を
//   sequence で適用する (旧: pickedUid 1 件のみ適用、残りは silent ignore = BUG)。
//
// rules: 15-abilities-effects.md (効果解決順), 19-special-rules.md (AP/LP/level 下限なし)
// 検証対象: src/engine/effect/apply-pick.ts (applyPickAndContinuation)

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyPickAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { char as readChar } from '@/engine/read/char';
import type { GameState, SceneCharacter } from '@/engine/types';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { sceneChar as baseScene } from '../../helpers/fixtures';

function sceneChar(cardId: string, uid: string, ap = 5000): SceneCharacter {
  return baseScene(cardId, uid, { apOverride: ap });
}

function setupState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.opp.scene = [
    sceneChar('D11015', 'e1'),
    sceneChar('D11015', 'e2'),
    sceneChar('D11015', 'e3'),
  ];
  return s;
}

function makePendingPA(verb: string, args: Record<string, unknown>, candidates: { uid: string; cardId: string; player: 'self' | 'opp' }[]): PendingEffectPickSide {
  return {
    player: 'self',
    atomVerb: verb,
    atomArgs: { ...args, uid: '$pick' },
    candidates,
    nMin: 0,
    nMax: candidates.length,
    source: { cardId: 'TEST', abilityId: 'a1' },
  } as unknown as PendingEffectPickSide;
}

describe('engine-extension #3: multi-target Pattern A pick', () => {
  beforeAll(() => registerAll());
  beforeEach(() => {
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
    (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation = [];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('pickedUids 単一なら従来動作 (Pattern A 1 件適用)', () => {
    const s = setupState();
    const apBefore = readChar.ap(s, 'e1');
    const pending = makePendingPA('charModifyAP', { player: 'self', delta: -1000, scope: 'turn' }, [
      { uid: 'e1', cardId: 'D11015', player: 'opp' },
    ]);
    applyPickAndContinuation(s, pending, 'e1');
    expect(readChar.ap(s, 'e1'), 'e1 に AP-1000').toBe(apBefore - 1000);
    expect(readChar.ap(s, 'e2'), 'e2 は不変').toBe(apBefore);
  });

  it('pickedUids 複数で各 uid に atom が per-char 適用される (B02021 沖田総司 a1 同型: N枚まで AP-1000)', () => {
    const s = setupState();
    const apBefore = readChar.ap(s, 'e1');
    const pending = makePendingPA('charModifyAP', { player: 'self', delta: -1000, scope: 'turn' }, [
      { uid: 'e1', cardId: 'D11015', player: 'opp' },
      { uid: 'e2', cardId: 'D11015', player: 'opp' },
      { uid: 'e3', cardId: 'D11015', player: 'opp' },
    ]);
    // multi-pick: pickedUid='e1' (代表) + pickedUids=['e1','e2','e3']
    applyPickAndContinuation(s, pending, 'e1', ['e1', 'e2', 'e3']);
    expect(readChar.ap(s, 'e1'), 'e1 に -1000').toBe(apBefore - 1000);
    expect(readChar.ap(s, 'e2'), 'e2 に -1000').toBe(apBefore - 1000);
    expect(readChar.ap(s, 'e3'), 'e3 に -1000').toBe(apBefore - 1000);
  });

  it('pickedUids 2 件で 部分選択 (3 候補中 2 件)', () => {
    const s = setupState();
    const apBefore = readChar.ap(s, 'e1');
    const pending = makePendingPA('charModifyAP', { player: 'self', delta: -2000, scope: 'turn' }, [
      { uid: 'e1', cardId: 'D11015', player: 'opp' },
      { uid: 'e2', cardId: 'D11015', player: 'opp' },
      { uid: 'e3', cardId: 'D11015', player: 'opp' },
    ]);
    applyPickAndContinuation(s, pending, 'e1', ['e1', 'e3']);
    expect(readChar.ap(s, 'e1'), 'e1 に -2000').toBe(apBefore - 2000);
    expect(readChar.ap(s, 'e2'), 'e2 不変 (選択されず)').toBe(apBefore);
    expect(readChar.ap(s, 'e3'), 'e3 に -2000').toBe(apBefore - 2000);
  });

  it('AI 経路の chooseAiPick も multi-pick (nMax>1) で全候補に適用 (greedy)', () => {
    const s = setupState();
    const apBefore = readChar.ap(s, 'e1');
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [
      makePendingPA('charModifyAP', { player: 'self', delta: -500, scope: 'turn' }, [
        { uid: 'e1', cardId: 'D11015', player: 'opp' },
        { uid: 'e2', cardId: 'D11015', player: 'opp' },
        { uid: 'e3', cardId: 'D11015', player: 'opp' },
      ]),
    ];
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(readChar.ap(s, 'e1'), 'e1 -500').toBe(apBefore - 500);
    expect(readChar.ap(s, 'e2'), 'e2 -500').toBe(apBefore - 500);
    expect(readChar.ap(s, 'e3'), 'e3 -500').toBe(apBefore - 500);
  });
});
