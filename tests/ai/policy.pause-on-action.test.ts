// Phase 8 完全クローズ Commit 2.5: playTurn pauseOnAction tests
//
// rules: 07-action-flow.md (アクション宣言の per-step 化)
// spec: Commit 2.5 plan — useOppTurnDriver per-step 移行

import { describe, it, expect, beforeEach } from 'vitest';
import { playTurn, type AIPolicy } from '@/ai/policy';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { createEmptyGameState } from '@/engine/state-factory';
import * as flow from '@/engine/flow/index.js';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import type { Move } from '@/ai/move-enumerator';
import { makeChar as baseChar } from '../helpers/fixtures';

function makeChar(uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseChar({ cardId: 'cX', uid, state, enterOrder: 0 });
}

function makeOppTurn(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  // opp side ready to attack
  s.players.opp.scene = [makeChar('o1', 'active')];
  // self side has a target
  s.players.self.scene = [makeChar('s1', 'sleep')];
  s.players.opp.case = { cardId: 'C1', status: '事件編', requiredEvidence: 6, colors: ['blue'] };
  s.players.self.case = { cardId: 'C2', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
  s.players.opp.deck = ['x1', 'x2'];
  s.players.self.deck = ['y1', 'y2'];
  return s;
}

/** action move のみを選び続ける policy (テスト用) */
class ActionFirstPolicy implements AIPolicy {
  choose(state: GameState, candidates: Move[]): Move | null {
    // actionAgainstChar を優先、無ければ endTurn
    const action = candidates.find((m) => m.kind === 'actionAgainstChar');
    if (action) return action;
    return candidates.find((m) => m.kind === 'endTurn') ?? null;
  }
}

/** 常に endTurn を選ぶ policy (テスト用) */
class EndTurnPolicy implements AIPolicy {
  choose(_state: GameState, candidates: Move[]): Move | null {
    return candidates.find((m) => m.kind === 'endTurn') ?? null;
  }
}

describe('playTurn pauseOnAction (Commit 2.5)', () => {
  beforeEach(() => {
    flow.action._resetActionContexts();
  });

  it('pauseOnAction: true → action move 検出時に paused で early return (applyMove せず)', () => {
    const state = makeOppTurn();
    const result = playTurn(state, new ActionFirstPolicy(), 'opp', { pauseOnAction: true });

    expect(result.paused).toBeDefined();
    expect(result.paused?.move.kind).toBe('actionAgainstChar');
    // applyMove されていない → opp.o1 はまだ active (declare されればスリープ化される)
    expect(result.finalState.players.opp.scene.find((c) => c.uid === 'o1')?.state).toBe('active');
    // moves[] にも push されていない
    expect(result.moves.find((m) => m.kind === 'actionAgainstChar')).toBeUndefined();
  });

  it('pauseOnAction: true でも endTurn move は通常通り (paused 発火しない)', () => {
    const state = makeOppTurn();
    const result = playTurn(state, new EndTurnPolicy(), 'opp', { pauseOnAction: true });

    expect(result.paused).toBeUndefined();
    expect(result.moves.length).toBe(1);
    expect(result.moves[0].kind).toBe('endTurn');
  });

  it('pauseOnAction 省略時は既存挙動 (回帰): action move を applyMove して継続', () => {
    const state = makeOppTurn();
    const result = playTurn(state, new HeuristicPolicy(), 'opp');

    expect(result.paused).toBeUndefined();
    // action または endTurn のいずれかに到達して終了
    expect(result.finalState).toBeDefined();
  });
});
