// BUG-250: 未初期化パートナーを共通パートナーactionとして使用できてはならない。
// rules: 01-victory-conditions.md, 06-card-types.md, 13-keywords.md

import { afterEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { startCausalSession } from '@/engine/log/causal';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { isAllowed } from '@/ui/hooks/useEngineDispatch/can-check';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { canAssistForUi, canSolveCaseForUi } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { useGameStateStore } from '@/ui/state/store';
import { canAssist, canSolveCase, enumerateMoves } from '@/ai/move-enumerator';
import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';
type CommonAction = 'assist' | 'solveCase';

function readyState(player: Player): GameState {
  return produce(createEmptyGameState(), draft => {
    draft.turn.player = player;
    draft.turn.phase = 'main';
    const ps = draft.players[player];
    ps.partner.cardId = player === 'self' ? 'B01025' : 'B01026';
    ps.partner.state = 'active';
    ps.partner.location = 'partner-area';
    ps.case.status = '解決編';
    ps.case.requiredEvidence = 1;
    ps.evidence.push({ cardId: 'E1', faceUp: false });
  });
}

function expectAvailability(state: GameState, player: Player, action: CommonAction, expected: boolean): void {
  const ui = action === 'assist' ? canAssistForUi(state, player) : canSolveCaseForUi(state, player);
  const ai = action === 'assist' ? canAssist(state, player) : canSolveCase(state, player);
  const aiMoves = enumerateMoves(state, player).some(move => move.kind === action);
  expect.soft(ui, `${player} ${action} UI`).toBe(expected);
  expect.soft(ai, `${player} ${action} AI`).toBe(expected);
  expect.soft(aiMoves, `${player} ${action} AI enumeration`).toBe(expected);
  expect.soft(isAllowed(state, { type: action, player }), `${player} ${action} dispatch`).toBe(expected);
}

afterEach(() => useGameStateStore.getState().resetMatchSessionState());

describe('BUG-250 common partner action identity/location gate', () => {
  it('rejects assist and solveCase when no partner card is initialized', () => {
    const empty = produce(createEmptyGameState(), draft => { draft.turn.phase = 'main'; });
    const winnableWithoutPartner = produce(empty, draft => {
      draft.players.self.case.status = '解決編';
      draft.players.self.case.requiredEvidence = 1;
      draft.players.self.evidence.push({ cardId: 'E1', faceUp: false });
    });

    expect(empty.players.self.partner.cardId).toBe('');
    expect.soft(canAssistForUi(empty, 'self')).toBe(false);
    expect.soft(canAssist(empty, 'self')).toBe(false);
    expect.soft(isAllowed(empty, { type: 'assist', player: 'self' })).toBe(false);
    expect.soft(canSolveCaseForUi(winnableWithoutPartner, 'self')).toBe(false);
    expect.soft(canSolveCase(winnableWithoutPartner, 'self')).toBe(false);
    expect.soft(isAllowed(winnableWithoutPartner, { type: 'solveCase', player: 'self' })).toBe(false);

    useGameStateStore.getState().setGameState(empty);
    expect.soft(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
    useGameStateStore.getState().setGameState(winnableWithoutPartner);
    expect.soft(dispatchEngineAction({ type: 'solveCase', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('rejects solveCase while the partner is outside partner-area', () => {
    const game = produce(readyState('self'), draft => {
      draft.players.self.partner.location = 'mr-removed';
    });

    expect.soft(canSolveCaseForUi(game, 'self')).toBe(false);
    expect.soft(canSolveCase(game, 'self')).toBe(false);
    expect.soft(isAllowed(game, { type: 'solveCase', player: 'self' })).toBe(false);
    useGameStateStore.getState().setGameState(game);
    expect.soft(dispatchEngineAction({ type: 'solveCase', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('keeps an initialized active partner in partner-area available to every consumer', () => {
    const game = readyState('self');

    expect.soft(canAssistForUi(game, 'self')).toBe(true);
    expect.soft(canAssist(game, 'self')).toBe(true);
    expect.soft(isAllowed(game, { type: 'assist', player: 'self' })).toBe(true);
    expect.soft(canSolveCaseForUi(game, 'self')).toBe(true);
    expect.soft(canSolveCase(game, 'self')).toBe(true);
    expect.soft(isAllowed(game, { type: 'solveCase', player: 'self' })).toBe(true);
  });

  it.each(['mr-removed', 'file-area'] as const)('rejects both actions while partner location is %s', location => {
    const game = produce(readyState('self'), draft => {
      draft.players.self.partner.location = location;
    });
    expectAvailability(game, 'self', 'assist', false);
    expectAvailability(game, 'self', 'solveCase', false);
  });

  it('rejects both actions while an otherwise valid partner is inactive', () => {
    const game = produce(readyState('self'), draft => {
      draft.players.self.partner.state = 'sleep';
    });

    expectAvailability(game, 'self', 'assist', false);
    expectAvailability(game, 'self', 'solveCase', false);
  });

  it.each(['auto', 'end'] as const)('rejects both actions during %s phase', phase => {
    const game = produce(readyState('self'), draft => { draft.turn.phase = phase; });
    expectAvailability(game, 'self', 'assist', false);
    expectAvailability(game, 'self', 'solveCase', false);
  });

  it('rejects both actions outside the requested player turn in both directions', () => {
    const selfTurn = readyState('self');
    const oppTurn = readyState('opp');
    expectAvailability(selfTurn, 'opp', 'assist', false);
    expectAvailability(selfTurn, 'opp', 'solveCase', false);
    expectAvailability(oppTurn, 'self', 'assist', false);
    expectAvailability(oppTurn, 'self', 'solveCase', false);
  });

  it('keeps legacy hydrated partners without optional turnEffects actionable', () => {
    const game = produce(readyState('self'), draft => {
      delete draft.players.self.partner.turnEffects;
    });
    expectAvailability(game, 'self', 'assist', true);
    expectAvailability(game, 'self', 'solveCase', true);
  });

  it('rejects terminal assist through UI, public dispatch, and AI enumeration', () => {
    const game = produce(readyState('self'), draft => {
      draft.gameResult = { winner: 'opp', reason: 'deck-out' };
    });

    expectAvailability(game, 'self', 'assist', false);
    useGameStateStore.getState().setGameState(game);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('rejects terminal solveCase through UI, public dispatch, and AI enumeration', () => {
    const game = produce(readyState('self'), draft => {
      draft.gameResult = { winner: 'opp', reason: 'deck-out' };
    });

    expectAvailability(game, 'self', 'solveCase', false);
    useGameStateStore.getState().setGameState(game);
    expect(dispatchEngineAction({ type: 'solveCase', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it.each(['self', 'opp'] as const)('completes normal public dispatch for %s assist and solveCase', player => {
    const assistState = readyState(player);
    useGameStateStore.getState().setGameState(assistState);
    expect(dispatchEngineAction({ type: 'assist', player })).toEqual({ ok: true });
    const afterAssist = useGameStateStore.getState().gameState!;
    expect(afterAssist.players[player].partner).toMatchObject({ state: 'sleep', location: 'file-area' });

    const solveState = structuredClone(readyState(player));
    const sessionId = `dispatch-solve-${player}`;
    startCausalSession(solveState, sessionId);
    resetPresentationQueue(sessionId);
    useGameStateStore.getState().setGameState(solveState);
    expect(dispatchEngineAction({ type: 'solveCase', player })).toEqual({ ok: true });
    const afterSolve = useGameStateStore.getState().gameState!;
    expect(afterSolve.players[player].partner.state).toBe('sleep');
    expect(afterSolve.gameResult).toEqual({ winner: player, reason: 'evidence' });
    expect(afterSolve.log.at(-1)).toMatchObject({ kind: 'game-result', actor: player });
  });
});
