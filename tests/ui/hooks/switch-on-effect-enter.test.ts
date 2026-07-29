// switch-on-effect-enter (rules/20 §スイッチ): 現場満杯の効果登場 (D11014 a2 reanimate) で、
// human が SceneSwitchPickerModal で退場キャラを選ぶと switchRemoveUid 付きで resolve され、
// engine が switchEnter で登場 → step3 $entered conditional の 1 ドローも発火する統合テスト。
// (UI の Playmat.resolveSceneEnterPick が collect → dispatch する switchRemoveUid を直接渡して再現)
//
// rules: 20-color-and-switch.md §スイッチ, 15-abilities-effects.md

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { registerAll } from '@/cards';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';


// shigo(D11014, source) + フィラー4枚 = 現場満杯(5枚)。reanimate 対象は remove。
function setupFull(reanimateTarget: string): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    d.players.self.scene.push(sceneChar('D11014', 'shigo'));
    d.players.self.scene.push(sceneChar('D11013', 'f1'));
    d.players.self.scene.push(sceneChar('D11013', 'f2'));
    d.players.self.scene.push(sceneChar('D11013', 'f3'));
    d.players.self.scene.push(sceneChar('D11013', 'f4'));
    d.players.self.hand = ['D08013'];        // step1 discard 用
    d.players.self.remove = [reanimateTarget]; // step2 reanimate 対象
    d.players.self.deck = ['D08014'];        // step3 draw 対象
  });
}

function pendingUidFor(cardId: string): string {
  const pending = useGameStateStore.getState().pendingEffectPick;
  const cand = pending!.candidates.find((c) => c.cardId === cardId) ?? pending!.candidates[0];
  return cand!.uid;
}

describe('switch-on-effect-enter — 現場満杯の reanimate を switch で登場 (human)', () => {
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

  it('満杯時、reanimate 対象を選び switchRemoveUid を渡すと退場キャラを退けて登場し step3 draw も発火', () => {
    useGameStateStore.setState({ gameState: setupFull('D11011') });

    // 宣言能力 a2 (cost sleepSelf は dispatcher が def から自動支払い — Phase 2c 契約)
    // → step1 discard pick surface
    const r1 = dispatchEngineAction({ type: 'declaredAbility', uid: 'shigo', abilId: 'a2' });
    expect(r1.ok).toBe(true);
    // discard 解決 → step2 sceneEnter pick surface (満杯でも human は早期 skip されない)
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pendingUidFor('D08013') });
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb, '満杯でも reanimate pick が出る').toBe('sceneEnter');

    // reanimate pick を switchRemoveUid='f1' 付きで解決 (UI が SceneSwitchPickerModal で収集した想定)
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pendingUidFor('D11011'), switchRemoveUid: 'f1' });

    const gs = useGameStateStore.getState().gameState!;
    expect(gs.players.self.scene.length, 'スイッチなので現場 5 枚維持').toBe(5);
    expect(gs.players.self.scene.some((c) => c.cardId === 'D11011'), '萩原千速 が登場').toBe(true);
    expect(gs.players.self.scene.some((c) => c.uid === 'f1'), '退場キャラ f1 は消える').toBe(false);
    expect(gs.players.self.hand, 'step3 draw は成立').toEqual(['D08014']);
    expect(gs.players.self.deck, 'exact exhaustion → discard と switch 退場カードを即 refresh')
      .toEqual(expect.arrayContaining(['D08013', 'D11013']));
    expect(gs.players.self.deck).toHaveLength(2);
    expect(gs.players.self.remove).toHaveLength(0);
    expect(gs.refreshCount.self).toBe(1);
    expect(gs.players.opp.evidence).toHaveLength(1);
  });

  it('満杯時、switch を辞退 (pickedUid:null) すると reanimate されず draw もしない', () => {
    useGameStateStore.setState({ gameState: setupFull('D11011') });

    dispatchEngineAction({ type: 'declaredAbility', uid: 'shigo', abilId: 'a2' });
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pendingUidFor('D08013') });
    // 辞退 = pickedUid:null (Playmat: SceneSwitchPickerModal cancel 時の挙動)
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null });

    const gs = useGameStateStore.getState().gameState!;
    expect(gs.players.self.scene.some((c) => c.cardId === 'D11011'), 'reanimate されない').toBe(false);
    expect(gs.players.self.remove, '対象はリムーブに残る').toContain('D11011');
    expect(gs.players.self.deck.length, 'draw もしない → デッキ据え置き').toBe(1);
  });
});
