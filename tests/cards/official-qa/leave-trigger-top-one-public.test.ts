// qa: card:PR084:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:PR090:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:PR084:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:PR090:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// Rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index';
import { B01011 } from '@/cards/ct-p01/B01011';
import { B10022 } from '@/cards/ct-p10/B10022';
import { PR084 } from '@/cards/pr-01/PR084';
import { PR090 } from '@/cards/pr-01/PR090';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const LEAVE_QA = '366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58';
const UP_TO_QA = '3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d';
const ATTACKER = 'QA_PR_TOP_ATTACKER';
const VICTIM = 'QA_PR_TOP_VICTIM';
const DECOY = 'QA_PR_TOP_DECOY';

function fixtureCard(
  id: string,
  kind: CardDef['kind'] = 'character',
  traits: string[] = [],
): CardDef {
  return {
    id,
    no: id,
    kind,
    names: [id],
    colors: [...PR084.colors],
    level: kind === 'character' ? 1 : 0,
    ap: kind === 'character' ? (id === ATTACKER ? 9000 : 1000) : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits,
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function qa(card: CardDef, suffix: string): string {
  return `card:${card.id}:${suffix}`;
}

function restartSession(player: Player): void {
  endMatchSession();
  beginMatchSession(player);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(card: CardDef, turn: Player, deck: string[], includeVictim = false): void {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    makeChar({ cardId: card.id, uid: 'source', state: 'sleep' }),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
    ...(includeVictim ? [makeChar({ cardId: VICTIM, uid: 'victim', state: 'sleep' })] : []),
  ];
  state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.self.deck = [...deck];
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function removeThroughPublicContact(targetUid: string): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

function expectLeaveTrigger(card: CardDef): void {
  expect(current().pendingEffects.find((entry) => (
    entry.source.cardId === card.id
      && entry.source.uid === 'source'
      && entry.source.abilityId === 'a1'
      && entry.triggeredBy.hook === 'leave:to-remove'
  )), `${card.id}: exact public leave trigger provenance`).toMatchObject({
    source: { cardId: card.id, uid: 'source', abilityId: 'a1', player: 'self' },
    triggeredBy: { hook: 'leave:to-remove' },
  });
}

function pendingPick(card: CardDef, revealedCardIds: string[]) {
  expect(useGameStateStore.getState().pendingDeckReveal, `${card.id}: unresolved top-card presentation`).toMatchObject({
    player: 'self',
    revealed: revealedCardIds,
    source: { cardId: card.id, abilityId: 'a1' },
    awaitingPick: true,
  });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${card.id}: public deck-look choice`).toMatchObject({
    atomVerb: 'deckRevealUntil',
    source: { cardId: card.id, abilityId: 'a1' },
    nMin: 0,
  });
  return pending!;
}

function resolvePick(card: CardDef, cardId: string | null, revealedCardIds: string[]): void {
  const pending = pendingPick(card, revealedCardIds);
  const candidate = cardId === null ? null : pending.candidates.find((item) => item.cardId === cardId);
  if (cardId !== null) expect(candidate, `${card.id}: exact public deck candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: candidate?.uid ?? null,
  }))).toEqual({ ok: true });
}

function expectSettled(
  card: CardDef,
  completedReveal?: { revealed: string[]; matched: string | null },
): void {
  const actionId = useGameStateStore.getState().activeActionId;
  const reveal = useGameStateStore.getState().pendingDeckReveal;
  if (completedReveal) {
    expect(reveal, `${card.id}: completed reveal presentation`).toMatchObject({
      player: 'self',
      revealed: completedReveal.revealed,
      matched: completedReveal.matched,
      source: { cardId: card.id, abilityId: 'a1' },
    });
    expect(reveal?.awaitingPick, `${card.id}: reveal no longer awaits a choice`).not.toBe(true);
    useGameStateStore.getState().setPendingDeckReveal(null);
    expect(useGameStateStore.getState().pendingDeckReveal, `${card.id}: completed presentation dismissed`).toBeNull();
  } else {
    expect(reveal, `${card.id}: non-triggering path has no reveal presentation`).toBeNull();
  }
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${card.id}: terminal advance ${index + 1}`).toEqual({ ok: true });
  }
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${card.id}: no unresolved pick`).toBeNull();
  expect(store.pendingDeckReorder, `${card.id}: top-one never asks for remainder order`).toBeNull();
  expect(store.activeActionId, `${card.id}: no open action`).toBeNull();
  expect(current().pendingEffects.filter((entry) => (
    entry.source.cardId === card.id && (entry.state === 'pending' || entry.state === 'resolving')
  )), `${card.id}: no unresolved source effect`).toEqual([]);
}

function provePositive(card: CardDef) {
  restartSession('self');
  install(card, 'opp', [B01011.id, DECOY]);
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  const pending = pendingPick(card, [B01011.id]);
  const candidate = pending.candidates.find((item) => item.cardId === B01011.id);
  const choice = {
    range: [pending.nMin, pending.nMax],
    candidates: pending.candidates.map((item) => item.cardId),
    occurrenceWitness: candidate?.occurrenceWitness,
  };
  resolvePick(card, B01011.id, [B01011.id]);
  expectSettled(card, { revealed: [B01011.id], matched: B01011.id });
  return {
    choice,
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck],
    sourceInRemove: current().players.self.remove.includes(card.id),
  };
}

function proveDecline(card: CardDef) {
  restartSession('self');
  install(card, 'opp', [B01011.id, DECOY]);
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  const pending = pendingPick(card, [B01011.id]);
  const range = [pending.nMin, pending.nMax];
  resolvePick(card, null, [B01011.id]);
  expectSettled(card, { revealed: [B01011.id], matched: null });
  return {
    range,
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck],
    sourceInRemove: current().players.self.remove.includes(card.id),
  };
}

function proveNoMatch(card: CardDef) {
  restartSession('self');
  install(card, 'opp', [DECOY, B01011.id]);
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  const pending = pendingPick(card, [DECOY]);
  const choice = { range: [pending.nMin, pending.nMax], candidates: pending.candidates.map((item) => item.cardId) };
  resolvePick(card, null, [DECOY]);
  expectSettled(card, { revealed: [DECOY], matched: null });
  return { choice, hand: [...current().players.self.hand], deck: [...current().players.self.deck] };
}

function proveEmptyDeck(card: CardDef) {
  restartSession('self');
  install(card, 'opp', []);
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  const pending = pendingPick(card, []);
  const choice = { range: [pending.nMin, pending.nMax], candidates: pending.candidates.map((item) => item.cardId) };
  resolvePick(card, null, []);
  expectSettled(card, { revealed: [], matched: null });
  return {
    choice,
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck],
    sourceInRemove: current().players.self.remove.includes(card.id),
  };
}

function proveWrongTiming(card: CardDef) {
  restartSession('self');
  install(card, 'self', [B01011.id, DECOY]);
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  const removal = useGameStateStore.getState().pendingEffectPick;
  expect(removal).toMatchObject({ source: { cardId: B10022.id, abilityId: 'a1' } });
  const source = removal!.candidates.find((item) => item.uid === 'source');
  expect(source).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(removal!, {
    type: 'effectPickResolve', pickedUid: source!.uid,
  }))).toEqual({ ok: true });
  expectSettled(card);
  return {
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck],
    sourceInRemove: current().players.self.remove.includes(card.id),
    triggerCount: current().pendingEffects.filter((entry) => entry.source.cardId === card.id).length,
  };
}

function proveOtherLeave(card: CardDef) {
  restartSession('self');
  install(card, 'opp', [B01011.id, DECOY], true);
  removeThroughPublicContact('victim');
  expectSettled(card);
  return {
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck],
    sourceOnScene: current().players.self.scene.some((entry) => entry.uid === 'source'),
    victimInRemove: current().players.self.remove.includes(VICTIM),
    triggerCount: current().pendingEffects.filter((entry) => entry.source.cardId === card.id).length,
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  registerAll();
  [fixtureCard(ATTACKER), fixtureCard(VICTIM), fixtureCard(DECOY, 'event', [...B01011.traits])].forEach(register);
  registerTriggeredListener();
  restartSession('self');
});

afterEach(() => endMatchSession());

describe('PR084/PR090 top-one leave ability through public dispatch', () => {
  for (const card of [PR084, PR090]) {
    it(qa(card, LEAVE_QA), () => {
      const positive = provePositive(card);
      const wrongTiming = proveWrongTiming(card);
      const otherLeave = proveOtherLeave(card);
      expect({ positive, wrongTiming, otherLeave }, `${card.id}: only its opponent-turn leave takes the matching top card`).toEqual({
        positive: { choice: { range: [0, 1], candidates: [B01011.id], occurrenceWitness: expect.stringMatching(/^occ:v1:self:deck:/) }, hand: [B01011.id], deck: [DECOY], sourceInRemove: true },
        wrongTiming: { hand: [], deck: [B01011.id, DECOY], sourceInRemove: true, triggerCount: 0 },
        otherLeave: { hand: [], deck: [B01011.id, DECOY], sourceOnScene: true, victimInRemove: true, triggerCount: 0 },
      });
    });

    it(qa(card, UP_TO_QA), () => {
      const decline = proveDecline(card);
      const noMatch = proveNoMatch(card);
      const emptyDeck = proveEmptyDeck(card);
      expect({ decline, noMatch, emptyDeck }, `${card.id}: up-to-one permits zero and never creates a remainder-order choice`).toEqual({
        decline: { range: [0, 1], hand: [], deck: [DECOY, B01011.id], sourceInRemove: true },
        noMatch: { choice: { range: [0, 0], candidates: [] }, hand: [], deck: [B01011.id, DECOY] },
        emptyDeck: { choice: { range: [0, 0], candidates: [] }, hand: [], deck: [], sourceInRemove: true },
      });
    });
  }

  it('keeps the complete PR084/PR090 ability contracts identical', () => {
    expect(PR090.abilities, 'PR090 print keeps both complete PR084 abilities').toEqual(PR084.abilities);
  });
});
