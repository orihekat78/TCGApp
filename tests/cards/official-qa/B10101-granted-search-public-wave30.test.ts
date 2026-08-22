// qa: card:B10101:10a900367f7fe2bb97f89519de6c2707375ecf532cb3d2dc8e368059e8f5470e

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B10101 } from '@/cards/ct-p10/B10101';
import { event } from '@/engine/event';
import { _peekPendingDeckRevealSide } from '@/engine/effect/atom-handlers';
import { _peekPendingDeckReorderSide } from '@/engine/effect/atom-handlers/_shared.js';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = 'card:B10101:10a900367f7fe2bb97f89519de6c2707375ecf532cb3d2dc8e368059e8f5470e';
const GIVER = 'B10101_PUBLIC_GIVER';
const VICTIM = 'B10101_PUBLIC_VICTIM';
const ASSAULT = 'B10101_PUBLIC_ASSAULT';
const FILLER = 'B10101_PUBLIC_FILLER';
const DECOY = 'B10101_PUBLIC_DECOY';
const TAIL = 'B10101_PUBLIC_TAIL';

function character(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...overrides,
  };
}

const GIVER_DEF = character(GIVER, { colors: ['緑'], ap: 9000 });
const VICTIM_DEF = character(VICTIM, { colors: ['赤'], ap: 1000 });
const ASSAULT_DEF = character(ASSAULT, { colors: ['緑'], keywords: ['突撃'] });
const FILLER_DEF = character(FILLER);
const DECOY_DEF = character(DECOY);
const TAIL_DEF = character(TAIL);

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing B10101 public state');
  return state;
}

function stateFor(player: Player): GameState {
  const state = createEmptyGameState();
  const defender = other(player);
  state.turn = { number: 6, player, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[player].case = {
    cardId: B10101.id, status: '解決編', requiredEvidence: 7,
    colors: ['緑', '白'], declaredUseCount: {},
  };
  state.players[player].evidence = [0, 1].map(index => ({
    cardId: `B10101_PUBLIC_EVIDENCE_${index}`,
    faceUp: false,
    origin: { turn: 1, via: 'effect' as const },
  }));
  state.players[player].file = Array.from({ length: 6 }, () => ({
    type: 'card-back' as const, cardId: FILLER,
  }));
  state.players[defender].file = Array.from({ length: 6 }, () => ({
    type: 'card-back' as const, cardId: FILLER,
  }));
  state.players[player].scene = [makeChar({ cardId: GIVER, uid: 'giver', state: 'active' })];
  state.players[defender].scene = [makeChar({ cardId: VICTIM, uid: 'victim', state: 'sleep' })];
  state.players[player].deck = [FILLER, ASSAULT, DECOY, TAIL];
  state.players[defender].deck = [FILLER, DECOY, TAIL, FILLER];
  return state;
}

function install(player: Player): void {
  expect(useGameStateStore.getState().setGameState(stateFor(player))).toBe(true);
}

function grantThroughDeclaredAbility(player: Player): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: `case:${player}`, abilId: 'a2',
    costParams: { flipFaceUpEvidence: { indices: [0, 1] } },
  })).toEqual({ ok: true });

  if (player === 'self') {
    const grant = useGameStateStore.getState().pendingEffectPick;
    expect(grant?.atomVerb).toBe('charGrantAbility');
    expect(grant?.candidates.map(candidate => candidate.uid)).toEqual(['giver']);
    expect(dispatchEngineAction(bindPendingDecision(grant!, {
      type: 'effectPickResolve', pickedUid: 'giver',
    }))).toEqual({ ok: true });
  } else {
    expect(useGameStateStore.getState().pendingEffectPick,
      'CPU grant never becomes a human decision').toBeNull();
  }

  expect(current().players[player].evidence.every(card => card.faceUp)).toBe(true);
  expect(current().players[player].scene[0]?.turnEffects.grantedAbilities).toEqual([
    expect.objectContaining({ id: 'b10101-granted-assault-search' }),
  ]);
}

function contactAndJudge(player: Player): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'giver', targetUid: 'victim',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
    .toEqual({ ok: true });
  for (let step = 0; step < 15; step += 1) {
    const context = flow.action._getContext(current(), actionId!);
    if (!context) throw new Error(`B10101 contact ${actionId} ended before judge`);
    if (context.phase === 'action-1' || context.phase === 'action-1-redo' || context.phase === 'action-2') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const actingPlayer = current().players.self.scene.some(card => card.uid === actingUid) ? 'self' : 'opp';
      expect(dispatchEngineAction({
        type: 'actionContact', actionId: actionId!, player: actingPlayer, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
      continue;
    }
    if (context.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
      return actionId!;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  }
  throw new Error(`B10101 contact ${actionId} did not reach judge`);
}

function resolveHumanTail(actionId: string): void {
  useGameStateStore.getState().setPendingDeckReveal(null);
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  expect(reorder).not.toBeNull();
  expect(dispatchEngineAction(bindPendingDecision(reorder!, {
    type: 'deckReorderResolve', order: [...reorder!.cardIds],
  }))).toEqual({ ok: true });
  for (let step = 0; step < 3 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  for (const card of [B10101, GIVER_DEF, VICTIM_DEF, ASSAULT_DEF, FILLER_DEF, DECOY_DEF, TAIL_DEF]) {
    register(card);
  }
  registerTriggeredListener();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('B10101 public declared-grant and contact-removal path', () => {
  it(`${QA}: human may decline the qualifying assault after the real contact trigger`, () => {
    install('self');
    grantThroughDeclaredAbility('self');
    const actionId = contactAndJudge('self');

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({
      player: 'self', atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1,
      source: {
        cardId: GIVER, abilityId: 'b10101-granted-assault-search', uid: 'giver', area: 'scene',
      },
    });
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([ASSAULT]);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'self', visibility: 'private', viewer: 'self', awaitingPick: true,
      revealed: [FILLER, ASSAULT, DECOY, TAIL],
    });
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();

    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.self.hand).toEqual([]);
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(current().players.opp.remove).toContain(VICTIM);
    resolveHumanTail(actionId);
    expect(current().players.self.deck).toEqual([FILLER, ASSAULT, DECOY, TAIL]);
  });

  it('publishes only the selected assault after the real human dispatch path', () => {
    install('self');
    grantThroughDeclaredAbility('self');
    const actionId = contactAndJudge('self');
    const pick = useGameStateStore.getState().pendingEffectPick!;
    const selected = pick.candidates.find(candidate => candidate.cardId === ASSAULT)!;

    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: selected.uid,
    }))).toEqual({ ok: true });
    const publication = useGameStateStore.getState().pendingPublicHandReveal;
    expect(publication).toMatchObject({
      owner: 'self', audience: 'all', cardIds: [ASSAULT], lifetime: 'presentation',
      origin: 'deck-selected-card',
      source: { cardId: GIVER, abilityId: 'b10101-granted-assault-search', uid: 'giver' },
    });
    expect(publication?.cardIds).not.toEqual(expect.arrayContaining([FILLER, DECOY, TAIL]));
    expect(current().players.self.hand).toEqual([ASSAULT]);
    expect(current().players.opp.remove).toContain(VICTIM);

    useGameStateStore.getState().setPendingPublicHandReveal(null);
    resolveHumanTail(actionId);
    expect(current().players.self.deck).toEqual([FILLER, DECOY, TAIL]);
  });

  it('keeps the CPU look private and publishes only its selected assault on the real path', () => {
    install('opp');
    grantThroughDeclaredAbility('opp');
    const actionId = contactAndJudge('opp');

    expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
    expect(_peekPendingDeckRevealSide()).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
    expect(_peekPendingDeckReorderSide()).toBeNull();
    const publication = useGameStateStore.getState().pendingPublicHandReveal;
    expect(publication).toMatchObject({
      owner: 'opp', audience: 'all', cardIds: [ASSAULT], lifetime: 'presentation',
      origin: 'deck-selected-card',
      source: { cardId: GIVER, abilityId: 'b10101-granted-assault-search', uid: 'giver' },
    });
    expect(publication?.cardIds).not.toEqual(expect.arrayContaining([FILLER, DECOY, TAIL]));
    expect(current().players.opp.hand).toEqual([ASSAULT]);
    expect(current().players.opp.deck).toEqual([FILLER, DECOY, TAIL]);
    expect(current().players.self.remove).toContain(VICTIM);

    useGameStateStore.getState().setPendingPublicHandReveal(null);
    for (let step = 0; step < 3 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });
});
