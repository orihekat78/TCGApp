// BUG-107: D11014 a2 human 経路で sceneEnter の bind:'$entered' が pick-resolve 越しに
// continuation (step3 conditional) へ伝播せず、萩原千速 登場時の 1 ドローが不発になる回帰テスト。
//
// rules: 15-abilities-effects.md, 21-declared-ability-cost.md
//
// 根本原因: useEngineDispatch.effectPickResolve は (1) pick 解決した sceneEnter atom と
//   (2) continuation remainder (conditional) を別々の event.queue で実行する。entryToCtx は
//   entry.bindings から ctx.bindings を復元するが、両 queue とも bindings を渡していないため
//   sceneEnter が書いた $entered は別 ctx に消え、step3 の boundMatchesFilter が空 bindings を読む。
// 修正: continuation を peek して chainCont.ctx.bindings を resolved-atom queue と
//   continuation queue の両方に渡し、同一 bindings object を共有させる。

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { registerAll } from '@/cards';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';


// 直接 push (mutate.scene.enter は 'enter' を emit して D11014 a1 疾風 を誤発火させるため)
function setupD11014a2(reanimateTarget: string): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    d.players.self.scene.push(sceneChar('D11014', 'shigo'));
    d.players.self.hand = ['D08013'];        // step1 discard 用フィラー
    d.players.self.remove = [reanimateTarget]; // step2 reanimate 対象
    d.players.self.deck = ['D08014'];        // step3 draw 対象
  });
}

function pendingUidFor(cardId: string): string {
  const pending = useGameStateStore.getState().pendingEffectPick;
  const cand = pending!.candidates.find((c) => c.cardId === cardId) ?? pending!.candidates[0];
  return cand!.uid;
}

describe('D11014 a2 — human 経路の $entered bind 伝播 (BUG-107)', () => {
  beforeAll(() => registerAll());

  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
    _clearPendingEffectPickQueue();
    (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation = [];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  afterEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('萩原千速(D11011) を登場させた場合、step3 conditional が $entered を読んで 1 ドローする', () => {
    useGameStateStore.setState({ gameState: setupD11014a2('D11011') });

    // 宣言能力 a2 (cost sleepSelf は dispatcher が def から自動支払い — Phase 2c 契約)
    // → step1 discard pick が surface
    const r1 = dispatchEngineAction({ type: 'declaredAbility', uid: 'shigo', abilId: 'a2' });
    expect(r1.ok, 'declaredAbility 成功').toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb, 'step1 discard pick が surface').toBe('discard');

    // discard pick を解決 → continuation [step2,step3] 再 queue → step2 sceneEnter pick が surface
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pendingUidFor('D08013') });
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb, 'step2 sceneEnter pick が surface').toBe('sceneEnter');

    // sceneEnter pick を解決 → 萩原千速 登場 + $entered 書込 → continuation [step3] conditional → draw
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pendingUidFor('D11011') });

    const gs = useGameStateStore.getState().gameState!;
    expect(gs.players.self.scene.map((c) => c.cardId), '萩原千速 が登場').toContain('D11011');
    expect(gs.players.self.hand, 'discard 1 + draw 1 → ドローしたカードが手札').toEqual(['D08014']);
    expect(gs.players.self.deck, 'draw の exact exhaustion → discard カードを即 refresh').toEqual(['D08013']);
    expect(gs.players.self.remove).toHaveLength(0);
    expect(gs.refreshCount.self).toBe(1);
    expect(gs.players.opp.evidence).toHaveLength(1);
  });

  it('萩原千速 以外(D11012, 警察 Lv4) を登場させた場合は 1 ドローしない (boundMatchesFilter 否定の確認)', () => {
    useGameStateStore.setState({ gameState: setupD11014a2('D11012') });

    dispatchEngineAction({ type: 'declaredAbility', uid: 'shigo', abilId: 'a2' });
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pendingUidFor('D08013') });
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pendingUidFor('D11012') });

    const gs = useGameStateStore.getState().gameState!;
    expect(gs.players.self.scene.map((c) => c.cardId), '警察 Lv4 が登場').toContain('D11012');
    expect(gs.players.self.deck.length, '萩原千速 以外なのでドローなし → デッキ据え置き').toBe(1);
  });
});
