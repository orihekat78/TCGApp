// qa: card:B01065:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B03069:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B03130:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B05056:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B06009:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B06026:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B06080:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:D03013:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:D04010:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// Rules: 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B01065 } from '@/cards/ct-p01/B01065';
import { B03069 } from '@/cards/ct-p03/B03069';
import { B03130 } from '@/cards/ct-p03/B03130';
import { B05056 } from '@/cards/ct-p05/B05056';
import { B06009 } from '@/cards/ct-p06/B06009';
import { B06026 } from '@/cards/ct-p06/B06026';
import { B06080 } from '@/cards/ct-p06/B06080';
import { B10022 } from '@/cards/ct-p10/B10022';
import { D03013 } from '@/cards/ct-d03/D03013';
import { D04010 } from '@/cards/ct-d04/D04010';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA_SUFFIX = '366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58';
const ATTACKER = 'QA_LEAVE_ATTACKER';
const VICTIM = 'QA_LEAVE_VICTIM';
const SELF_TOP = 'QA_SELF_TOP';
const SELF_TAIL = 'QA_SELF_TAIL';
const SELF_KEEP = 'QA_SELF_KEEP';
const OPP_TOP = 'QA_OPP_TOP';
const OPP_TAIL = 'QA_OPP_TAIL';
const OPP_KEEP = 'QA_OPP_KEEP';
const OPP_DROP = 'QA_OPP_DROP';

const cards = [B01065, B03069, B03130, B05056, B06009, B06026, B06080, D03013, D04010] as const;

function qa(card: CardDef): string {
  return `card:${card.id}:${QA_SUFFIX}`;
}

function fixtureCard(id: string, ap = 1000): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['blue'], level: 1, ap, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function stateFor(card: CardDef, turn: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    makeChar({ cardId: card.id, uid: 'source', state: 'sleep' }),
    makeChar({ cardId: VICTIM, uid: 'victim', state: 'active' }),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
  ];
  state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.self.deck = [SELF_TOP, SELF_TAIL];
  state.players.opp.deck = [OPP_TOP, OPP_TAIL];
  state.players.self.hand = [SELF_KEEP];
  state.players.opp.hand = [OPP_KEEP, OPP_DROP];
  return state;
}

function restartSession(player: Player): void {
  endMatchSession();
  beginMatchSession(player);
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function removeSourceThroughPublicContact(): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' })).toEqual({ ok: true });
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

function expectLeaveTrigger(card: CardDef, abilityId: string): void {
  expect(current().pendingEffects.find((entry) => (
    entry.source.cardId === card.id
      && entry.source.uid === 'source'
      && entry.source.abilityId === abilityId
      && entry.triggeredBy.hook === 'leave:to-remove'
  )), `${card.id}: exact leave trigger provenance`).toMatchObject({
    source: { cardId: card.id, uid: 'source', abilityId, player: 'self' },
    triggeredBy: { hook: 'leave:to-remove' },
  });
}

function resolveOptional(card: CardDef, run: boolean): void {
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending, `${card.id}: optional is public`).toMatchObject({ source: { cardId: card.id } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run }))).toEqual({ ok: true });
}

function resolvePick(card: CardDef, cardIdOrUid: string): void {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${card.id}: pick is public`).not.toBeNull();
  const candidate = pending!.candidates.find((item) => item.uid === cardIdOrUid || item.cardId === cardIdOrUid);
  expect(candidate, `${card.id}: exact public candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function effectZoneSnapshot(state: GameState): unknown {
  return {
    selfScene: state.players.self.scene
      .filter((char) => char.uid !== 'source' && char.uid !== 'remover')
      .map((char) => ({ uid: char.uid, cardId: char.cardId, state: char.state })),
    oppScene: state.players.opp.scene.map((char) => ({ uid: char.uid, cardId: char.cardId, state: char.state })),
    selfHand: [...state.players.self.hand],
    oppHand: [...state.players.opp.hand],
    selfDeck: [...state.players.self.deck],
    oppDeck: [...state.players.opp.deck],
    selfEvidence: state.players.self.evidence.map((entry) => ({ cardId: entry.cardId, faceUp: entry.faceUp })),
    oppEvidence: state.players.opp.evidence.map((entry) => ({ cardId: entry.cardId, faceUp: entry.faceUp })),
  };
}

type SelfTurnProof = {
  sourceInRemove: boolean;
  effectZonesUnchanged: unknown;
  before: unknown;
  triggerCount: number;
  pendingPick: unknown;
  pendingOptional: unknown;
  activeActionId: string | null;
};

function proveSelfTurnNoTrigger(card: CardDef, abilityId: string): SelfTurnProof {
  restartSession('self');
  install(stateFor(card, 'self'));
  const before = effectZoneSnapshot(current());
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  resolvePick(B10022, 'source');
  const state = current();
  return {
    sourceInRemove: state.players.self.remove.includes(card.id),
    effectZonesUnchanged: effectZoneSnapshot(state),
    before,
    triggerCount: state.pendingEffects.filter((entry) => (
      entry.source.cardId === card.id
        && entry.source.abilityId === abilityId
        && entry.triggeredBy.hook === 'leave:to-remove'
    )).length,
    pendingPick: useGameStateStore.getState().pendingEffectPick,
    pendingOptional: useGameStateStore.getState().pendingEffectOptional,
    activeActionId: useGameStateStore.getState().activeActionId,
  };
}

function expectSettled(card: CardDef): void {
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${card.id}: public action terminal advance ${index + 1}`).toEqual({ ok: true });
  }
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${card.id}: no unresolved pick`).toBeNull();
  expect(store.pendingEffectOptional, `${card.id}: no unresolved optional`).toBeNull();
  expect(store.pendingEffectChoice, `${card.id}: no unresolved choice`).toBeNull();
  expect(store.activeActionId, `${card.id}: no open action`).toBeNull();
  expect(Object.keys(current().actionContexts ?? {}), `${card.id}: no retained action context`).toEqual([]);
  expect(current().pendingEffects.filter((entry) => (
    entry.source.cardId === card.id && (entry.state === 'pending' || entry.state === 'resolving')
  )), `${card.id}: no unresolved source effect`).toEqual([]);
}

function proveDraw(card: CardDef, abilityId: string): {
  hand: string[];
  deck: string[];
  remove: string[];
  negative: SelfTurnProof;
} {
  install(stateFor(card, 'opp'));
  removeSourceThroughPublicContact();
  expectLeaveTrigger(card, abilityId);
  expectSettled(card);
  return {
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck],
    remove: [...current().players.self.remove],
    negative: proveSelfTurnNoTrigger(card, abilityId),
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [...cards, B10022, fixtureCard(ATTACKER, 9000), fixtureCard(VICTIM)].forEach(register);
  registerTriggeredListener();
  restartSession('self');
});

afterEach(() => endMatchSession());

describe('opponent-turn leave triggers through public action dispatch', () => {
  it(qa(B03130), () => {
    const proof = proveDraw(B03130, 'a1');
    expect(proof, `${B03130.id}: opponent-turn leave draws; self-turn leave does not`).toMatchObject({
      hand: [SELF_KEEP, SELF_TOP], deck: [SELF_TAIL], remove: [B03130.id],
      negative: { sourceInRemove: true, effectZonesUnchanged: proof.negative.before, triggerCount: 0, pendingPick: null, pendingOptional: null, activeActionId: null },
    });
  });

  it(qa(B05056), () => {
    const proof = proveDraw(B05056, 'a1');
    expect(proof, `${B05056.id}: opponent-turn leave draws; self-turn leave does not`).toMatchObject({
      hand: [SELF_KEEP, SELF_TOP], deck: [SELF_TAIL], remove: [B05056.id],
      negative: { sourceInRemove: true, effectZonesUnchanged: proof.negative.before, triggerCount: 0, pendingPick: null, pendingOptional: null, activeActionId: null },
    });
  });

  it(qa(D03013), () => {
    const proof = proveDraw(D03013, 'a1');
    expect(proof, `${D03013.id}: opponent-turn leave draws; self-turn leave does not`).toMatchObject({
      hand: [SELF_KEEP, SELF_TOP], deck: [SELF_TAIL], remove: [D03013.id],
      negative: { sourceInRemove: true, effectZonesUnchanged: proof.negative.before, triggerCount: 0, pendingPick: null, pendingOptional: null, activeActionId: null },
    });
  });

  it(qa(B06009), () => {
    install(stateFor(B06009, 'opp'));
    removeSourceThroughPublicContact();
    expectLeaveTrigger(B06009, 'a1');
    resolvePick(B06009, SELF_TOP);
    expect(current().players.self.hand, `${B06009.id}: draw then exact public discard`).toEqual([SELF_KEEP]);
    expect(current().players.self.deck, `${B06009.id}: draw consumes the physical top card`).toEqual([SELF_TAIL]);
    expect([...current().players.self.remove].sort(), `${B06009.id}: discarded draw and source only`).toEqual([B06009.id, SELF_TOP].sort());
    expectSettled(B06009);
    const negative = proveSelfTurnNoTrigger(B06009, 'a1');
    expect(negative, `${B06009.id}: self-turn leave has no draw/discard`).toMatchObject({
      sourceInRemove: true, effectZonesUnchanged: negative.before, triggerCount: 0,
      pendingPick: null, pendingOptional: null, activeActionId: null,
    });
  });

  it(qa(B06080), () => {
    install(stateFor(B06080, 'opp'));
    removeSourceThroughPublicContact();
    expectLeaveTrigger(B06080, 'a1');
    resolvePick(B06080, SELF_TOP);
    expect(current().players.self.hand, `${B06080.id}: draw then exact public discard`).toEqual([SELF_KEEP]);
    expect(current().players.self.deck, `${B06080.id}: draw consumes the physical top card`).toEqual([SELF_TAIL]);
    expect([...current().players.self.remove].sort(), `${B06080.id}: discarded draw and source only`).toEqual([B06080.id, SELF_TOP].sort());
    expectSettled(B06080);
    const negative = proveSelfTurnNoTrigger(B06080, 'a1');
    expect(negative, `${B06080.id}: self-turn leave has no draw/discard`).toMatchObject({
      sourceInRemove: true, effectZonesUnchanged: negative.before, triggerCount: 0,
      pendingPick: null, pendingOptional: null, activeActionId: null,
    });
  });

  it(qa(B06026), () => {
    install(stateFor(B06026, 'opp'));
    removeSourceThroughPublicContact();
    expectLeaveTrigger(B06026, 'a2');
    expect(current().players.self.remove, `${B06026.id}: source leaves remove with no duplicate`).toEqual([]);
    expect(current().players.self.evidence, `${B06026.id}: exact source becomes face-up evidence`).toEqual([
      expect.objectContaining({ cardId: B06026.id, faceUp: true }),
    ]);
    expectSettled(B06026);
    const negative = proveSelfTurnNoTrigger(B06026, 'a2');
    expect(negative, `${B06026.id}: self-turn leave stays in remove`).toMatchObject({
      sourceInRemove: true, effectZonesUnchanged: negative.before, triggerCount: 0,
      pendingPick: null, pendingOptional: null, activeActionId: null,
    });
  });

  it(qa(D04010), () => {
    install(stateFor(D04010, 'opp'));
    removeSourceThroughPublicContact();
    expectLeaveTrigger(D04010, 'a1');
    expect(useGameStateStore.getState().pendingEffectPick, `${D04010.id}: mandatory discard auto-resolves`).toBeNull();
    expect(current().players.self.remove, `${D04010.id}: source reaches owner remove exactly once`).toEqual([D04010.id]);
    expect(current().players.opp.hand, `${D04010.id}: exactly one opponent card remains`).toHaveLength(1);
    expect(current().players.opp.remove, `${D04010.id}: exactly one opponent card is discarded`).toHaveLength(1);
    expect([
      ...current().players.opp.hand,
      ...current().players.opp.remove,
    ].sort(), `${D04010.id}: discard conserves the two physical cards`).toEqual([OPP_KEEP, OPP_DROP].sort());
    expectSettled(D04010);
    const negative = proveSelfTurnNoTrigger(D04010, 'a1');
    expect(negative, `${D04010.id}: self-turn leave has no opponent discard`).toMatchObject({
      sourceInRemove: true, effectZonesUnchanged: negative.before, triggerCount: 0,
      pendingPick: null, pendingOptional: null, activeActionId: null,
    });
  });

  it(qa(B03069), () => {
    install(stateFor(B03069, 'opp'));
    removeSourceThroughPublicContact();
    expectLeaveTrigger(B03069, 'a2');
    resolveOptional(B03069, true);
    expect(current().players.self.remove, `${B03069.id}: source reaches owner remove exactly once`).toEqual([B03069.id]);
    expect(current().players.self.deck, `${B03069.id}: owner evidence consumes deck top`).toEqual([SELF_TAIL]);
    expect(current().players.opp.deck, `${B03069.id}: opponent evidence consumes deck top`).toEqual([OPP_TAIL]);
    expect(current().players.self.evidence, `${B03069.id}: owner gains exact face-down evidence`).toEqual([
      expect.objectContaining({ cardId: SELF_TOP, faceUp: false }),
    ]);
    expect(current().players.opp.evidence, `${B03069.id}: opponent gains exact face-down evidence`).toEqual([
      expect.objectContaining({ cardId: OPP_TOP, faceUp: false }),
    ]);
    expectSettled(B03069);
    const negative = proveSelfTurnNoTrigger(B03069, 'a2');
    expect(negative, `${B03069.id}: self-turn leave has no optional evidence gain`).toMatchObject({
      sourceInRemove: true, effectZonesUnchanged: negative.before, triggerCount: 0,
      pendingPick: null, pendingOptional: null, activeActionId: null,
    });
  });

  it(qa(B01065), () => {
    install(stateFor(B01065, 'opp'));
    removeSourceThroughPublicContact();
    expectLeaveTrigger(B01065, 'a1');
    resolveOptional(B01065, true);
    expect(current().players.opp.deck, `${B01065.id}: opponent evidence consumes deck top`).toEqual([OPP_TAIL]);
    expect(current().players.opp.evidence, `${B01065.id}: opponent gains exact face-down evidence`).toEqual([
      expect.objectContaining({ cardId: OPP_TOP, faceUp: false }),
    ]);
    resolvePick(B01065, 'victim');
    expect(current().players.self.scene.some((char) => char.uid === 'victim'), `${B01065.id}: selected level-1 victim leaves`).toBe(false);
    expect([...current().players.self.remove].sort(), `${B01065.id}: source and victim reach owner remove exactly once`).toEqual([
      B01065.id, VICTIM,
    ].sort());
    expectSettled(B01065);
    const negative = proveSelfTurnNoTrigger(B01065, 'a1');
    expect(negative, `${B01065.id}: self-turn leave has no optional evidence/removal`).toMatchObject({
      sourceInRemove: true, effectZonesUnchanged: negative.before, triggerCount: 0,
      pendingPick: null, pendingOptional: null, activeActionId: null,
    });
  });
});
