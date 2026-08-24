// qa: card:B07059:94d4fbcb6d6b527d8e1d1c0eaa9b309fe2198ea03d499bf7e02c1d5a00121143
// qa: card:B07060:94d4fbcb6d6b527d8e1d1c0eaa9b309fe2198ea03d499bf7e02c1d5a00121143
// qa: card:PR195:94d4fbcb6d6b527d8e1d1c0eaa9b309fe2198ea03d499bf7e02c1d5a00121143
// qa: card:PR196:94d4fbcb6d6b527d8e1d1c0eaa9b309fe2198ea03d499bf7e02c1d5a00121143
// qa: card:PR291:94d4fbcb6d6b527d8e1d1c0eaa9b309fe2198ea03d499bf7e02c1d5a00121143
// qa: card:PR297:94d4fbcb6d6b527d8e1d1c0eaa9b309fe2198ea03d499bf7e02c1d5a00121143
// Rules: 10-action-event.md. A player may decline Hirameki.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07059 } from '@/cards/ct-p07/B07059';
import { B07059P } from '@/cards/ct-p07/B07059P';
import { B07060 } from '@/cards/ct-p07/B07060';
import { B07060P } from '@/cards/ct-p07/B07060P';
import { PR195 } from '@/cards/pr-01/PR195';
import { PR196 } from '@/cards/pr-01/PR196';
import { PR291 } from '@/cards/pr-01/PR291';
import { PR297 } from '@/cards/pr-01/PR297';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import {
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

const ROWS = [B07059, B07059P, B07060, B07060P, PR195, PR196, PR291, PR297] as const;
const SEED = ['QA_W95_PA_SEED_A', 'QA_W95_PA_SEED_B'] as const;
const REMOVE_DECOY = 'QA_W95_REMOVE_DECOY';
const TAIL = 'QA_W95_TAIL';

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave95 game state');
  return state;
}

function stateFor(owner: Player): GameState {
  const state = createEmptyGameState();
  state.players[owner].partnerAreaCards = [...SEED];
  state.players[owner].remove = [REMOVE_DECOY];
  state.players.self.deck = [TAIL, TAIL];
  state.players.opp.deck = [TAIL, TAIL];
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetRegistry();
  _resetUidCounter();
  _resetPendingHirameki();
  _resetHiramekiRegistered();
  _resetTriggeredRegistered();
  registerAll();
  registerHiramekiListener();
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetPendingHirameki();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('Wave95 public Hirameki decline keeps the event in remove', () => {
  it.each(ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner $owner may decline without changing partner-area cards',
    ({ card, owner }) => {
      const { actionId, pending } = openCaseHirameki(stateFor(owner), card.id, {
        evidencePlayer: owner,
        humanPlayer: owner,
        sessionLabel: `${card.id}-wave95-${owner}`,
      });
      expect(pending).toMatchObject({ player: owner, cardId: card.id, abilityId: 'a2' });
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'hiramekiResolve', choice: 'skip',
      }))).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });

      // Card-bound decline matrix: B07059 B07059P B07060 B07060P PR195 PR196 PR291 PR297.
      expect(current().players[owner].partnerAreaCards).toEqual([...SEED]);
      expect(current().players[owner].remove).toEqual([REMOVE_DECOY, card.id]);
      expect(useGameStateStore.getState().pendingHirameki).toBeNull();
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().activeActionId).toBeNull();
    },
  );
});
