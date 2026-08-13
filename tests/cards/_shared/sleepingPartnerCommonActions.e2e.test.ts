// Official Q&A semantic cluster: a sleeping partner cannot Assist or solve a case.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { mutate } from '@/engine/mutate';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { isAllowed } from '@/ui/hooks/useEngineDispatch/can-check';
import { canAssistForUi, canSolveCaseForUi } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { useGameStateStore } from '@/ui/state/store';

function gameWithPartner(cardId: string, state: 'active' | 'sleep'): GameState {
  const game = createEmptyGameState();
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  mutate.partner.init(game, 'self', cardId);
  game.players.self.partner.state = state;
  game.players.self.case.status = '解決編';
  game.players.self.case.requiredEvidence = 1;
  game.players.self.evidence.push({ cardId: 'EVIDENCE', faceUp: false });
  return game;
}

describe('sleeping partner common-action Q&A cluster', () => {
  beforeAll(() => registerAll());
  afterEach(() => useGameStateStore.getState().resetMatchSessionState());

  const partnerIds = [
    'B01001', 'B01002', 'B01003', 'B01004', 'B01025', 'B01026', 'B01042', 'B01043', 'B01060',
    'B01061', 'B01079', 'B01080', 'D01001', 'D02001', 'D03001', 'D04001', 'D05001', 'D07001',
  ] as const;

  it.each(partnerIds)('%s rejects both common actions while sleeping', cardId => {
    const active = gameWithPartner(cardId, 'active');
    expect(canAssistForUi(active, 'self')).toBe(true);
    expect(canSolveCaseForUi(active, 'self')).toBe(true);

    const sleeping = gameWithPartner(cardId, 'sleep');
    const before = structuredClone(sleeping);
    expect(canAssistForUi(sleeping, 'self')).toBe(false);
    expect(canSolveCaseForUi(sleeping, 'self')).toBe(false);
    expect(isAllowed(sleeping, { type: 'assist', player: 'self' })).toBe(false);
    expect(isAllowed(sleeping, { type: 'solveCase', player: 'self' })).toBe(false);

    useGameStateStore.getState().setGameState(sleeping);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'solveCase', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toEqual(before);
  });
});
