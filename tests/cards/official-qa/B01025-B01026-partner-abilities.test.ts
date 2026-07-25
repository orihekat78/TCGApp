// Official Q&A: B01025/B01025P/B01026/B01026P
// 「【事件解決】と【アシスト】は、パートナーがスリープ状態でも行えますか？」→ いいえ。
// rules: 01-victory-conditions.md, 03-field-areas.md, 06-card-types.md, 13-keywords.md

import { afterEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { mutate } from '@/engine/mutate';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types';
import { isAllowed } from '@/ui/hooks/useEngineDispatch/can-check';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { canAssistForUi, canSolveCaseForUi, enumPartnerAbilityIds } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { useGameStateStore } from '@/ui/state/store';

const cards = ['B01025', 'B01025P', 'B01026', 'B01026P'] as const;

function withPartner(cardId: string, state: 'active' | 'sleep' | 'stun' = 'active'): GameState {
  return produce(createEmptyGameState(), draft => {
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
    mutate.partner.init(draft, 'self', cardId);
    draft.players.self.partner.state = state;
  });
}

function withWinnablePartner(cardId: string, state: 'active' | 'sleep' | 'stun' = 'active'): GameState {
  return produce(withPartner(cardId, state), draft => {
    draft.players.self.case.status = '解決編';
    draft.players.self.case.requiredEvidence = 1;
    draft.players.self.evidence.push({ cardId: 'E1', faceUp: false });
  });
}

afterEach(() => useGameStateStore.getState().resetMatchSessionState());

describe.each(cards)('$0 official common partner actions', cardId => {
  it('are intentionally dedicated UI actions, not card-declared abilities', () => {
    const game = withPartner(cardId);
    expect(game.players.self.partner.cardId).toBe(cardId);
    expect(enumPartnerAbilityIds(game, 'self')).toEqual([]);
    expect(canAssistForUi(game, 'self')).toBe(true);
    expect(isAllowed(game, { type: 'assist', player: 'self' })).toBe(true);
  });

  it.each(['sleep', 'stun'] as const)('rejects both actions while %s', state => {
    const game = withWinnablePartner(cardId, state);
    expect(game.turn).toMatchObject({ player: 'self', phase: 'main' });
    expect(game.players.self.partner.cardId).toBe(cardId);
    expect(game.players.self.case.status).toBe('解決編');
    expect(game.players.self.evidence).toHaveLength(game.players.self.case.requiredEvidence);
    expect(canAssistForUi(game, 'self')).toBe(false);
    expect(canSolveCaseForUi(game, 'self')).toBe(false);
    expect(isAllowed(game, { type: 'assist', player: 'self' })).toBe(false);
    expect(isAllowed(game, { type: 'solveCase', player: 'self' })).toBe(false);

    useGameStateStore.getState().setGameState(game);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'solveCase', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('assists from active through the public dispatcher and then rejects solveCase', () => {
    const game = withPartner(cardId);
    useGameStateStore.getState().setGameState(game);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.partner.cardId).toBe(cardId);
    expect(after.players.self.partner).toMatchObject({ state: 'sleep', location: 'file-area' });
    expect(isAllowed(after, { type: 'solveCase', player: 'self' })).toBe(false);
    expect(dispatchEngineAction({ type: 'solveCase', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('solves only from active after resolved case and enough evidence', () => {
    const game = withWinnablePartner(cardId);
    expect(game.players.self.partner.cardId).toBe(cardId);
    expect(canSolveCaseForUi(game, 'self')).toBe(true);
    expect(isAllowed(game, { type: 'solveCase', player: 'self' })).toBe(true);

    useGameStateStore.getState().setGameState(game);
    expect(dispatchEngineAction({ type: 'solveCase', player: 'self' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
  });
});
