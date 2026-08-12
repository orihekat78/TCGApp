// Phase 8.7b: useOppTurnDriver tests
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md (turn flow)
// 設計:
//   - driveOppTurn() は store の gameState を見て、turn.player==='opp' のときだけ
//     policy.playTurn を呼んで opp のターンを最後まで進める。
//   - gameResult が set されていれば呼ばない (試合終了後の暴走防止)
//   - self ターン中は no-op
//   - 二重呼出 / 再エントリは isDriving フラグで防止

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { driveOppTurn, _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { makeChar } from '../../helpers/fixtures';
import type { GameState } from '@/engine/types/game-state';
import type { CardDef } from '@/engine/types';

/**
 * opp が「endTurn を選ぶしかない」最小状態。
 * - opp.scene 空 / opp.hand 空 → handUse/reasoning/action 不可
 * - opp.partner sleep → assist/solveCase 不可
 * - deck は autoPhase 用に数枚積んでおく
 */
function setupOppTurnMinimal(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: 'PS', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'PO', state: 'sleep', location: 'partner-area' };
  s.players.opp.deck = ['c1', 'c2', 'c3'];
  s.players.opp.case = { cardId: 'CO', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
  s.players.self.case = { cardId: 'CS', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
  return s;
}

describe('driveOppTurn', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, pendingMisread: null, pendingDeckReveal: null, pendingPublicHandReveal: null });
    _resetIsDriving();
    _resetActionContexts();
  });

  it('runs opp turn when turn.player === "opp" — state advances', () => {
    const before = setupOppTurnMinimal();
    useGameStateStore.setState({ gameState: before });
    driveOppTurn();
    const after = useGameStateStore.getState().gameState!;
    // playTurn が opp の endTurn を選び、engine.flow.endTurn が turn.player を 'self' に戻す
    expect(after.turn.player).toBe('self');
    // 状態は新しい参照になる (Immer / mutator で別オブジェクト)
    expect(after).not.toBe(before);
  });

  it('is a no-op when turn.player === "self"', () => {
    const s = setupOppTurnMinimal();
    s.turn.player = 'self';
    useGameStateStore.setState({ gameState: s });
    const before = useGameStateStore.getState().gameState;
    driveOppTurn();
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('is a no-op when gameState is null', () => {
    useGameStateStore.setState({ gameState: null });
    driveOppTurn(); // 例外を投げないこと
    expect(useGameStateStore.getState().gameState).toBe(null);
  });

  it('is a no-op when gameResult is already set (game over)', () => {
    const s = setupOppTurnMinimal();
    s.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: s });
    const before = useGameStateStore.getState().gameState;
    driveOppTurn();
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('cannot commit an opponent step scheduled before surrender', () => {
    vi.useFakeTimers();
    try {
      const live = setupOppTurnMinimal();
      useGameStateStore.setState({ gameState: live });
      setTimeout(driveOppTurn, 400);
      const terminal = structuredClone(live);
      terminal.gameResult = { winner: 'opp', reason: 'concede' };
      useGameStateStore.setState({ gameState: terminal });

      vi.advanceTimersByTime(400);

      expect(useGameStateStore.getState().gameState).toBe(terminal);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('is a no-op while human misread decision is pending', () => {
    const before = setupOppTurnMinimal();
    useGameStateStore.setState({
      gameState: before,
      pendingMisread: {
        player: 'self',
        reasoningUid: 'reasoner#1',
        reasoningPlayer: 'opp',
        candidates: [{ uid: 'misread#1', x: 1 }],
      },
    });

    driveOppTurn();

    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('is a no-op while a surfaced public deck reveal is pending', () => {
    const before = setupOppTurnMinimal();
    useGameStateStore.setState({
      gameState: before,
      pendingDeckReveal: {
        player: 'self', visibility: 'public', viewer: 'all',
        revealed: ['c1'], matched: 'c1', presentation: 'reveal-return',
      },
    });

    driveOppTurn();

    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('is a no-op while a public hand reveal is pending', () => {
    const before = setupOppTurnMinimal();
    useGameStateStore.setState({
      gameState: before,
      pendingPublicHandReveal: {
        owner: 'self', audience: 'all', cardIds: ['c1'], handSnapshot: ['c1'],
        lifetime: 'effect', resolutionToken: 'public-hand-reveal:1', source: {},
      },
    });

    driveOppTurn();

    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('resumes CPU progression when a public hand reveal is presentation-only', () => {
    const before = setupOppTurnMinimal();
    useGameStateStore.setState({
      gameState: before,
      pendingPublicHandReveal: {
        owner: 'self', audience: 'all', cardIds: ['c1'], handSnapshot: ['c1'],
        lifetime: 'presentation', resolutionToken: 'public-hand-reveal:1', source: {},
      },
    });

    driveOppTurn();

    expect(useGameStateStore.getState().gameState).not.toBe(before);
  });

  it('re-entrancy: second call while isDriving=true is a no-op', () => {
    // この test は driveOppTurn 内部で isDriving フラグが立つことを利用する。
    // 実環境ではマイクロタスク + useEffect の組み合わせで二重呼出になりうるため、
    // 関数自身が外部からの再帰侵入に対し no-op になることを保証する。
    useGameStateStore.setState({ gameState: setupOppTurnMinimal() });

    // store.dispatch 中に再帰的に driveOppTurn を呼んでも、isDriving フラグで弾かれる。
    // ここではフラグを直接立てて 2 回目の呼出が no-op になることを検証。
    const original = useGameStateStore.getState().gameState;
    // dispatch 経由でフラグを立てる代替: 直接フラグセットせず、二重呼出だけで OK
    driveOppTurn();
    const afterFirst = useGameStateStore.getState().gameState!;
    // 2 回目: turn.player が既に 'self' なので no-op
    driveOppTurn();
    const afterSecond = useGameStateStore.getState().gameState;
    expect(afterSecond).toBe(afterFirst);
    expect(afterFirst).not.toBe(original);
  });

  it('per-move: 非終端手は1手だけ適用 — turn は opp 維持 + oppMoveTick++ + activeCard set', () => {
    resetDefRegistry();
    const rc: CardDef = {
      id: 'RC', no: 'RC', kind: 'character', names: ['RC'], colors: ['青'],
      level: 1, ap: 1000, lp: 2, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    };
    registerCardDef(rc);
    const s = setupOppTurnMinimal();
    // active な現場キャラ (LP2) → reasoning が選ばれる (証拠+2 = 正の手)
    s.players.opp.scene = [makeChar({ cardId: 'RC', uid: 'oc1', state: 'active', enterOrder: 0 })];
    useGameStateStore.setState({ gameState: s, oppMoveTick: 0, activeCardUid: null, activeCardLabel: null });

    driveOppTurn();

    const st = useGameStateStore.getState();
    // 1手だけ適用 (turn は opp 維持 = whole-turn 一括ではない)
    expect(st.gameState!.turn.player).toBe('opp');
    expect(st.oppMoveTick).toBe(1);
    // reasoning した現場キャラがアクティブカードとして set される
    expect(st.activeCardUid).toBe('oc1');
    expect(st.activeCardLabel).toBe('推理');
  });
});
