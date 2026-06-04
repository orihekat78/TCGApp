// BUG-109: PA 短縮形 atom (charModifyAP/LP 等) が AI/CPU 経路で silent no-op になる問題の修正検証。
// walk は PB 短縮形のみ展開し、PA 短縮形は runtime の tryRePickFromAtom (humanChooser:true 強制) で
// __pendingEffectPickQueue へ push → AI に drain 機構が無く no-op。drainAiEffectPicks で heuristic 解決する。
//
// rules: 15-abilities-effects.md, 17-icons.md (疾風), 19-special-rules.md (AP下限なし)

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { char as readChar } from '@/engine/read/char';
import { D11014 } from '@/cards/ct-d11/D11014';
import { D08024 } from '@/cards/ct-d08/D08024';
import type { EffectCtx, SceneCharacter } from '@/engine/types';

function sceneChar(cardId: string, uid: string): SceneCharacter {
  return {
    cardId, uid, state: 'sleep', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

function aiCtx(): EffectCtx {
  return { source: { player: 'self', cardId: 'D11014', uid: 'shigo', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
}

describe('BUG-109: AI 経路の PA 短縮形 pick drain (drainAiEffectPicks)', () => {
  beforeAll(() => registerAll());
  beforeEach(() => {
    _clearPendingEffectPickQueue();
    (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation = [];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; // CPU vs CPU
  });

  it('D11014 a1 (疾風 charModifyAP -1000) が AI 経路で敵キャラに適用される', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [sceneChar('D11015', 'enemy1')]; // 警察 Lv5 ap5000 (敵)
    const apBefore = readChar.ap(s, 'enemy1');

    // AI walk: charModifyAP 短縮形 (PA) は未展開のまま
    const policy = new HeuristicPolicy();
    const resolved = resolveEffectPicks(s, D11014.abilities[0].effect as never, aiCtx(), {
      chooseAtomTarget: policy.chooseAtomTarget?.bind(policy), byPlayer: 'self', humanChooser: false,
      source: { cardId: 'D11014', abilityId: 'a1' },
    });
    runEffect(s, resolved as never, aiCtx());

    // runtime で pick が queue に積まれ、まだ適用されていない
    expect(_peekPendingEffectPickQueueLength(), 'PA 短縮形 pick が queue に積まれる').toBeGreaterThanOrEqual(1);
    expect(readChar.ap(s, 'enemy1'), 'drain 前は AP 未変化').toBe(apBefore);

    // AI drain で heuristic 解決
    drainAiEffectPicks(s, policy);

    expect(_peekPendingEffectPickQueueLength(), 'drain 後 queue 空').toBe(0);
    expect(readChar.ap(s, 'enemy1'), '敵キャラに AP-1000 が適用される').toBe(apBefore - 1000);
  });

  it('D08024 a1 (sequence: 短縮形 sceneEnter → charModifyAP) が AI 経路で cross-step 解決される', () => {
    // step1 で 少年探偵団 をリムーブから登場 → step2 charModifyAP+2000 が「登場した」少年探偵団を対象。
    // drain が continuation を進め、step2 が post-step1 盤面 (登場キャラ含む) を見ることを検証 (BUG-105+109)。
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.remove = ['D08013']; // 少年探偵団 Lv4 ap4000 (reanimate 対象)

    const policy = new HeuristicPolicy();
    const ctx = { source: { player: 'self', cardId: 'D08024', uid: 'src', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    const resolved = resolveEffectPicks(s, D08024.abilities[0].effect as never, ctx, {
      chooseAtomTarget: policy.chooseAtomTarget?.bind(policy), byPlayer: 'self', humanChooser: false,
      source: { cardId: 'D08024', abilityId: 'a1' },
    });
    runEffect(s, resolved as never, ctx);
    drainAiEffectPicks(s, policy);

    const entered = s.players.self.scene.find((c) => c.cardId === 'D08013');
    expect(entered, '少年探偵団 がリムーブから登場').toBeTruthy();
    expect(s.players.self.remove, '登場した分はリムーブから除去').not.toContain('D08013');
    // step2 charModifyAP+2000 が登場キャラ (post-step1 盤面) を対象に適用される
    expect(readChar.ap(s, entered!.uid), 'AP 4000 + 2000 (cross-step)').toBe(6000);
    expect(_peekPendingEffectPickQueueLength(), 'drain 後 queue 空').toBe(0);
  });
});
