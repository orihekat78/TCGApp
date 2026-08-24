// qa: card:B05055:954d5e661b6a0db14e75a56af70b2eb74dcec6e8ac0f10646134ec418133b014
// qa: card:B06090:954d5e661b6a0db14e75a56af70b2eb74dcec6e8ac0f10646134ec418133b014
// qa: card:B10056:954d5e661b6a0db14e75a56af70b2eb74dcec6e8ac0f10646134ec418133b014
// Rules: 10-action-event.md. Hirameki source moves to remove after its effect resolves.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05055 } from '@/cards/ct-p05/B05055';
import { B06090 } from '@/cards/ct-p06/B06090';
import { B06090P } from '@/cards/ct-p06/B06090P';
import { B10056 } from '@/cards/ct-p10/B10056';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import {
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

type Row = { card: CardDef; targetId: string; targetTraits: string[] };
const ROWS: Row[] = [
  { card: B05055, targetId: 'W104-SUZUKI', targetTraits: ['鈴木財閥'] },
  { card: B06090, targetId: 'W104-POARO', targetTraits: ['喫茶ポアロ'] },
  { card: B06090P, targetId: 'W104-POARO', targetTraits: ['喫茶ポアロ'] },
  { card: B10056, targetId: 'W104-SHOGI', targetTraits: ['女流棋士'] },
];
const TAIL = 'W104-TAIL';

function fixture(id: string, traits: string[] = []): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 1, ap: 1000, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave104 state');
  return state;
}

function stateFor(row: Row, owner: Player): GameState {
  const state = createEmptyGameState();
  state.players[owner].remove = [row.targetId];
  state.players.self.deck = [TAIL, TAIL, TAIL];
  state.players.opp.deck = [TAIL, TAIL, TAIL];
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
  for (const row of ROWS) register(fixture(row.targetId, row.targetTraits));
  register(fixture(TAIL));
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

describe('official QA Wave104: a Hirameki cannot recover its still-resolving source card', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner excludes itself but may recover another matching removed character',
    ({ row, owner }) => {
      const { actionId, pending } = openCaseHirameki(stateFor(row, owner), row.card.id, {
        evidencePlayer: owner,
        humanPlayer: owner,
        sessionLabel: `${row.card.id}-wave104-${owner}`,
      });
      expect(pending).toMatchObject({ player: owner, cardId: row.card.id, abilityId: 'a2' });
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'hiramekiResolve', choice: 'fire',
      }))).toEqual({ ok: true });

      const pick = useGameStateStore.getState().pendingEffectPick;
      expect(pick?.atomVerb).toBe('handAddFromRemove');
      expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([row.targetId]);
      expect(current().players[owner].remove).not.toContain(row.card.id);
      const selected = pick!.candidates.find(candidate => candidate.cardId === row.targetId)!;
      expect(dispatchEngineAction(bindPendingDecision(pick!, {
        type: 'effectPickResolve', pickedUid: selected.uid,
      }))).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });

      // Card-bound physical rows: B05055, B06090/P, B10056.
      expect(current().players[owner].hand).toContain(row.targetId);
      expect(current().players[owner].hand).not.toContain(row.card.id);
      expect(current().players[owner].remove).toContain(row.card.id);
    },
  );
});
