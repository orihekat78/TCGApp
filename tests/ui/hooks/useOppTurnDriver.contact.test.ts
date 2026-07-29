// Phase 8 完全クローズ Commit 2.5: useOppTurnDriver per-step contact integration
//
// rules: 07-action-flow.md / 08-contact.md
// spec: Commit 2.5 plan

import { describe, it, expect, beforeEach } from 'vitest';
import { driveOppTurn, _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { useGameStateStore } from '@/ui/state/store';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { createEmptyGameState } from '@/engine/state-factory';
import * as flow from '@/engine/flow/index.js';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../helpers/fixtures';

function makeChar(uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseChar({ cardId: 'cX', uid, state, enterOrder: 0 });
}

function makeOppTurnWithAttackTarget(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  // opp ready to attack (no other moves available except action + endTurn)
  s.players.opp.scene = [makeChar('o1', 'active')];
  s.players.self.scene = [makeChar('s1', 'sleep')];
  s.players.opp.case = { cardId: 'C1', status: '事件編', requiredEvidence: 6, colors: ['blue'] };
  s.players.self.case = { cardId: 'C2', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
  // 手札 / hand 空 — handUseCard 候補がないようにして action か endTurn 一択
  s.players.opp.hand = [];
  s.players.self.hand = [];
  s.players.opp.deck = ['x1', 'x2'];
  s.players.self.deck = ['y1', 'y2'];
  // opp の case を解決編にして solveCase が必要証拠未達ですり抜けるように
  return s;
}

describe('useOppTurnDriver — Commit 2.5 contact integration', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    useContactModalStore.getState()._reset();
    flow.action._resetActionContexts();
    _resetIsDriving();
  });

  it('CPU が action を選ぶと activeActionId が set される (paused 経由 → declare dispatch)', () => {
    useGameStateStore.setState({ gameState: makeOppTurnWithAttackTarget() });
    driveOppTurn();
    // 何らかの move (reasoning / action / assist / endTurn etc) が走った後の状態を観察。
    // pauseOnAction が action を捉えた場合 activeActionId が set される。
    const after = useGameStateStore.getState().gameState!;
    const axId = useGameStateStore.getState().activeActionId;
    // ターンが続行中 = action paused (driver 引き継ぎ待ち), もしくは 'self' = endTurn 済
    if (axId !== null) {
      // action paused → opp 側 byUid はスリープ化済
      expect(after.turn.player).toBe('opp');
      const ax = flow.action._getContext(after, axId);
      expect(ax).toBeDefined();
      expect(ax?.byPlayer).toBe('opp');
    } else {
      // action なしでターン終了
      expect(after.turn.player).toBe('self');
    }
  });

  it('activeActionId が set 中は driveOppTurn が no-op (driver 担当を尊重)', () => {
    const s = makeOppTurnWithAttackTarget();
    useGameStateStore.setState({ gameState: s, activeActionId: 'ax_fake' });
    driveOppTurn();
    // state 変化なし
    expect(useGameStateStore.getState().gameState).toBe(s);
    expect(useGameStateStore.getState().activeActionId).toBe('ax_fake');
  });

  it('action なし状態で driveOppTurn が endTurn まで進める (回帰)', () => {
    // opp が完全に手詰まり: scene 空 / partner sleep / hand 空 → endTurn 一択
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.partner.state = 'sleep';
    useGameStateStore.setState({ gameState: s });
    driveOppTurn();
    expect(useGameStateStore.getState().gameState!.turn.player).toBe('self');
  });
});
