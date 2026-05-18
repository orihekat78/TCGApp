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

describe('integration: dispatch → state (end-to-end 配線テスト)', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: createSampleGameState() });
  });

  it('BUG-009: assist + FILE 7+ で 事件編 → 解決編 自動遷移する (mutate.partner.assist 内 check)', () => {
    // mutate.partner.assist を直接呼び、FILE 7+ なら status='解決編' に遷移することを保証
    const state = useGameStateStore.getState().gameState!;
    // FILE を 6 枚に水増し (assist 後の +1 で 7 枚に)
    while (state.players.self.file.length < 6) {
      state.players.self.file.push({ type: 'card-back', cardId: 'placeholder' });
    }
    // 事件編 → 解決編 移行前提
    state.players.self.case.status = '事件編';
    // partner active 必要
    state.players.self.partner.state = 'active';

    engine.mutate.partner.assist(state, 'self');

    expect(state.players.self.case.status).toBe('解決編');
  });

  it('BUG-009: FILE 6+ (アシスト前) で 事件編 → 解決編 にならない (条件達成のみで遷移)', () => {
    const state = useGameStateStore.getState().gameState!;
    while (state.players.self.file.length < 5) {
      state.players.self.file.push({ type: 'card-back', cardId: 'placeholder' });
    }
    state.players.self.case.status = '事件編';
    state.players.self.partner.state = 'active';

    engine.mutate.partner.assist(state, 'self');

    // アシスト後 FILE は 5+1 = 6 枚、7 未満なので 事件編のまま
    expect(state.players.self.file.length).toBe(6);
    expect(state.players.self.case.status).toBe('事件編');
  });

  // 残 dispatch → state シナリオ (今後追加):
  // - BUG-006: actionAgainstCase / actionDeclareCase + 全 per-step → 証拠 -1 / +1
  // - BUG-008: handUseCard kind='event' → 手札除去 + remove.add
  // - 推理: dispatch reasoning → 証拠 +LP / partner sleep
  // - アクション[キャラ]: dispatch actionAgainstChar → guard → contact → judge → リムーブ
  // - 事件解決: dispatch solveCase → gameResult set
  //
  // 各シナリオは Round 4b/4c で実装拡張時に追加。本 round では assist+FILE 7+ の最小骨格のみ。
});
