// Round 4a Phase 6.1: end-to-end integration test
//
// 目的: `dispatch → engine → state 変化` の通しテスト。
// Round 1-3 で多発した「mutator は完成しているが UI dispatch 経路から呼ばれない」
// 型のバグ (BUG-006 action[事件] 証拠変動 / BUG-008 event card 手札残留 /
// BUG-009 FILE 7+ で解決編未遷移) を自動検出するための基盤。
//
// 設計指針:
//   - dispatchEngineAction({ type: ... }) を直接呼び、useGameStateStore の state 変化を assert
//   - 各重要 action 1 通り (推理 / アクション[キャラ] / アクション[事件] /
//     アシスト / イベントカード / 解決編 / 勝利) をシナリオ化
//   - 詳細な edge case は単体 test (engine 直 / mutate 直) に任せ、本 test は dispatch → state の
//     **配線の存在** を保証する責務に絞る

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import * as engine from '@/engine/index.js';
import { registerAll } from '@/cards';

describe('integration: dispatch → state (end-to-end 配線テスト)', () => {
  beforeEach(() => {
    engine.flow.action._resetActionContexts();
    registerAll();
    useGameStateStore.setState({ gameState: createSampleGameState(), activeActionId: null });
  });

  it.each([
    'B05024', 'B08094', 'B09113', 'D10026', 'D11021', 'PR286', 'B10083', 'B07077',
    'D08026', 'D09027', 'B05118', 'B07062', 'B06013', 'B06106', 'B08044', 'B10061',
    'B06043', 'B10082', 'B10101', 'B05063', 'B06036', 'B08030', 'B09112', 'B06107',
    'B06108', 'B06109', 'B10019', 'B06105', 'B10102', 'B05120', 'B07091', 'B09090',
    'B05119', 'B08076', 'B07061', 'B05083', 'B06065', 'B10034', 'B10100',
  ])('Q&A assist threshold: %s forces 事件編 → 解決編 through dispatch', (caseCardId) => {
    const state = useGameStateStore.getState().gameState!;
    const caseDef = engine.read.def.card(caseCardId);
    expect(caseDef?.kind).toBe('case');

    state.players.self.case.cardId = caseCardId;
    state.players.self.case.status = '事件編';
    state.players.self.partner.state = 'active';
    state.players.self.partner.location = 'partner-area';
    const threshold = engine.read.game.partnerAssistFileThreshold(state, 'self');
    while (state.players.self.file.length < threshold - 1) {
      state.players.self.file.push({ type: 'card-back', cardId: 'placeholder' });
    }

    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });

    const stateAfter = useGameStateStore.getState().gameState!;
    expect(stateAfter.players.self.file.length).toBe(threshold);
    expect(stateAfter.players.self.case.status).toBe('解決編');
    expect(stateAfter.players.self.partner.state).toBe('sleep');
    expect(stateAfter.players.self.partner.location).toBe('file-area');
    expect(stateAfter.turnState.self.assistedThisTurn).toBe(true);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  // BUG-006: actionDeclareCase + per-step dispatch chain → 相手証拠 -1 / 自証拠 +1
  // rules/10: アクション[事件] がガードされなかった場合、相手証拠を1枚リムーブ + 自証拠+1
  //
  // 本テストは「dispatch chain は正常か」を検証する。
  // 実機 (Playwright) で再現するが Vitest で再現しない場合、bug は React reactivity 側。
  // 両方で再現する場合、bug は engine/dispatcher 側。
  it('BUG-006: actionDeclareCase → actionGuard(null) → 連続 advance → actionJudge で 相手証拠 -1 / 自証拠 +1', () => {
    const state = useGameStateStore.getState().gameState!;
    // self-2 (横溝重悟) を active 名乗り解除済に固定 — action[case] 可能状態
    const actor = state.players.self.scene.find((s) => s.uid === 'self-2');
    if (!actor) throw new Error('test fixture missing self-2');
    actor.state = 'active';
    actor.isNamed = false;
    // opp.scene を全 sleep/stun に倒し、guard 候補ゼロ状態にする (auto-pass シナリオ)
    for (const s of state.players.opp.scene) s.state = 'sleep';
    // opp partner はもともと sleep
    useGameStateStore.setState({ gameState: state });

    const oppEvidenceBefore = state.players.opp.evidence.length;
    const selfEvidenceBefore = state.players.self.evidence.length;
    const selfDeckBefore = state.players.self.deck.length;
    expect(oppEvidenceBefore).toBeGreaterThanOrEqual(1);
    expect(selfDeckBefore).toBeGreaterThanOrEqual(1);

    // 1. Declare action[case]
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'self-2', targetPlayer: 'opp' });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();

    // 2. Guard pass (null = ガードしない)
    dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null });

    // 3. 'judge' phase に到達するまで advance 連射 (max 10 step、安全策)
    for (let i = 0; i < 10; i++) {
      const ax = engine.flow.action._getContext(useGameStateStore.getState().gameState!, actionId!);
      if (!ax) break;
      if (ax.phase === 'judge') break;
      if (ax.phase === 'action-end' || ax.phase === 'contact-end') break;
      dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! });
    }

    // 4. judge phase に到達したことを確認
    const axAtJudge = engine.flow.action._getContext(useGameStateStore.getState().gameState!, actionId!);
    expect(axAtJudge?.phase).toBe('judge');

    // 5. actionJudge → 証拠変動
    dispatchEngineAction({ type: 'actionJudge', actionId: actionId! });

    // 6. judge → contact-end → action-end まで送る
    dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! });

    const stateAfter = useGameStateStore.getState().gameState!;
    expect(stateAfter.players.opp.evidence.length).toBe(oppEvidenceBefore - 1);
    expect(stateAfter.players.self.evidence.length).toBe(selfEvidenceBefore + 1);
    expect(stateAfter.players.self.deck.length).toBe(selfDeckBefore - 1);
  });

  it('BUG-006 拡張: guard 候補ありで人間 pass した場合も 証拠 -1 / +1 (driver 経路と同条件)', () => {
    const state = useGameStateStore.getState().gameState!;
    const actor = state.players.self.scene.find((s) => s.uid === 'self-2');
    if (!actor) throw new Error('test fixture missing self-2');
    actor.state = 'active';
    actor.isNamed = false;
    // opp-1 は既定で active → guard 候補となる。明示的に維持
    const oppGuard = state.players.opp.scene.find((s) => s.uid === 'opp-1');
    if (oppGuard) oppGuard.state = 'active';
    useGameStateStore.setState({ gameState: state });

    const oppEvidenceBefore = state.players.opp.evidence.length;
    const selfEvidenceBefore = state.players.self.evidence.length;

    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'self-2', targetPlayer: 'opp' });
    const actionId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null });

    for (let i = 0; i < 10; i++) {
      const ax = engine.flow.action._getContext(useGameStateStore.getState().gameState!, actionId);
      if (!ax || ax.phase === 'judge') break;
      if (ax.phase === 'action-end' || ax.phase === 'contact-end') break;
      dispatchEngineAction({ type: 'actionAdvance', actionId });
    }

    dispatchEngineAction({ type: 'actionJudge', actionId });
    dispatchEngineAction({ type: 'actionAdvance', actionId });

    const stateAfter = useGameStateStore.getState().gameState!;
    expect(stateAfter.players.opp.evidence.length).toBe(oppEvidenceBefore - 1);
    expect(stateAfter.players.self.evidence.length).toBe(selfEvidenceBefore + 1);
  });

  // BUG-029: 現場カードがアクション/推理してもスリープにならない (UI 反映)
  //
  // Round 4c の BUG-006 修正 (store.dispatch の shallow-copy fallback) で同根原因
  // (Zustand subscriber 不発火) として副次解消された。本テストは回帰防止用 lock。
  it('BUG-029: reasoning dispatch で scene character が sleep になり、store 観測で確認できる', () => {
    const state = useGameStateStore.getState().gameState!;
    const actor = state.players.self.scene.find((s) => s.uid === 'self-2');
    if (!actor) throw new Error('test fixture missing self-2');
    actor.state = 'active';
    actor.isNamed = false;
    useGameStateStore.setState({ gameState: state });

    dispatchEngineAction({ type: 'reasoning', uid: 'self-2' });
    engine.resolve.runAllUntilEmpty(useGameStateStore.getState().gameState!);

    const stateAfter = useGameStateStore.getState().gameState!;
    const actorAfter = stateAfter.players.self.scene.find((s) => s.uid === 'self-2');
    expect(actorAfter?.state).toBe('sleep');
  });

  it('BUG-029: actionDeclareCase dispatch で byUid character が sleep になる', () => {
    const state = useGameStateStore.getState().gameState!;
    const actor = state.players.self.scene.find((s) => s.uid === 'self-2');
    if (!actor) throw new Error('test fixture missing self-2');
    actor.state = 'active';
    actor.isNamed = false;
    for (const s of state.players.opp.scene) s.state = 'sleep';
    useGameStateStore.setState({ gameState: state });

    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'self-2', targetPlayer: 'opp' });

    const stateAfter = useGameStateStore.getState().gameState!;
    const actorAfter = stateAfter.players.self.scene.find((s) => s.uid === 'self-2');
    expect(actorAfter?.state).toBe('sleep');
  });

  // 残 dispatch → state シナリオ (今後追加):
  // - BUG-008: handUseCard kind='event' → 手札除去 + remove.add
  // - アクション[キャラ]: dispatch actionAgainstChar → guard → contact → judge → リムーブ
  // - 事件解決: dispatch solveCase → gameResult set
});
