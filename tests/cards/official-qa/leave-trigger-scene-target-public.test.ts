// qa: card:B03012:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B03013:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B03091:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B04010:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B04022:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B04030:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:D03004:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B04030:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B04030:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:D03004:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:D03004:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// Rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B03012 } from '@/cards/ct-p03/B03012';
import { B03013 } from '@/cards/ct-p03/B03013';
import { B03091 } from '@/cards/ct-p03/B03091';
import { B04010 } from '@/cards/ct-p04/B04010';
import { B04022 } from '@/cards/ct-p04/B04022';
import { B04022P } from '@/cards/ct-p04/B04022P';
import { B04030 } from '@/cards/ct-p04/B04030';
import { B04030P } from '@/cards/ct-p04/B04030P';
import { B10022 } from '@/cards/ct-p10/B10022';
import { D03004 } from '@/cards/ct-d03/D03004';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { read } from '@/engine/read/index';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA_SUFFIX = '366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58';
const ATTACKER = 'QA_SCENE_ATTACKER';
const VICTIM = 'QA_SCENE_VICTIM';
const DECK_TOP = 'QA_SCENE_DECK_TOP';
const DECK_TAIL = 'QA_SCENE_DECK_TAIL';
const KUDO_MATCH = 'QA_KUDO_SCENE_MATCH';
const KUDO_LEVEL_DECOY = 'QA_KUDO_SCENE_LEVEL_DECOY';
const KUDO_NAME_DECOY = 'QA_KUDO_SCENE_NAME_DECOY';
const KUDO_EVENT = 'QA_KUDO_SCENE_EVENT';
const HATTORI_MATCH = 'QA_HATTORI_SCENE_MATCH';
const HATTORI_LEVEL_DECOY = 'QA_HATTORI_SCENE_LEVEL_DECOY';
const HATTORI_NAME_DECOY = 'QA_HATTORI_SCENE_NAME_DECOY';
const HATTORI_EVENT = 'QA_HATTORI_SCENE_EVENT';
const SELF_TARGET = 'QA_SCENE_SELF_TARGET';
const SELF_DECOY = 'QA_SCENE_SELF_DECOY';
const OPP_TARGET = 'QA_SCENE_OPP_TARGET';
const OPP_DECOY = 'QA_SCENE_OPP_DECOY';
const SLEEP4_SELF = 'QA_SLEEP4_SELF';
const SLEEP5_SELF = 'QA_SLEEP5_SELF';
const SLEEP4_OPP = 'QA_SLEEP4_OPP';
const SLEEP5_OPP = 'QA_SLEEP5_OPP';
const STUN8_SELF = 'QA_STUN8_SELF';
const STUN9_SELF = 'QA_STUN9_SELF';
const STUN8_OPP = 'QA_STUN8_OPP';
const STUN9_OPP = 'QA_STUN9_OPP';
const D_STUN5_SELF = 'QA_D_STUN5_SELF';
const D_STUN6_SELF = 'QA_D_STUN6_SELF';
const D_STUN5_OPP = 'QA_D_STUN5_OPP';
const D_ACTIVE5_OPP = 'QA_D_ACTIVE5_OPP';
const D_ALREADY_STUN5_SELF = 'QA_D_ALREADY_STUN5_SELF';
const D_RULE_ACTOR = 'QA_D_RULE_ACTOR';

const sourceCards = [B03012, B03013, B03091, B04010, B04022, B04030, D03004] as const;

type FixtureOptions = {
  kind?: CardDef['kind'];
  names?: string[];
  level?: number;
  ap?: number;
  traits?: string[];
};

function fixtureCard(id: string, options: FixtureOptions = {}): CardDef {
  return {
    id,
    no: id,
    kind: options.kind ?? 'character',
    names: options.names ?? [id],
    colors: ['青'],
    level: options.level ?? 1,
    ap: options.kind === 'event' ? undefined : (options.ap ?? 1000),
    lp: options.kind === 'event' ? undefined : 1,
    traits: options.traits ?? [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const fixtureCards: CardDef[] = [
  fixtureCard(ATTACKER, { level: 9, ap: 9000 }),
  fixtureCard(VICTIM, { level: 1, ap: 1000 }),
  fixtureCard(DECK_TOP),
  fixtureCard(DECK_TAIL),
  fixtureCard(KUDO_MATCH, { names: ['工藤新一'], level: 6 }),
  fixtureCard(KUDO_LEVEL_DECOY, { names: ['工藤新一'], level: 7 }),
  fixtureCard(KUDO_NAME_DECOY, { names: ['工藤新二'], level: 4 }),
  fixtureCard(KUDO_EVENT, { kind: 'event', names: ['工藤新一'], level: 4 }),
  fixtureCard(HATTORI_MATCH, { names: ['服部平次'], level: 4 }),
  fixtureCard(HATTORI_LEVEL_DECOY, { names: ['服部平次'], level: 5 }),
  fixtureCard(HATTORI_NAME_DECOY, { names: ['服部平蔵'], level: 4 }),
  fixtureCard(HATTORI_EVENT, { kind: 'event', names: ['服部平次'], level: 4 }),
  fixtureCard(SELF_TARGET, { level: 4, ap: 4000, traits: ['警察'] }),
  fixtureCard(SELF_DECOY, { level: 9, ap: 5000 }),
  fixtureCard(OPP_TARGET, { level: 4, ap: 6000, traits: ['警察'] }),
  fixtureCard(OPP_DECOY, { level: 9, ap: 7000, traits: ['警察'] }),
  fixtureCard(SLEEP4_SELF, { level: 4, ap: 4000 }),
  fixtureCard(SLEEP5_SELF, { level: 5, ap: 5000 }),
  fixtureCard(SLEEP4_OPP, { level: 4, ap: 6000 }),
  fixtureCard(SLEEP5_OPP, { level: 5, ap: 7000 }),
  fixtureCard(STUN8_SELF, { level: 8, ap: 4000 }),
  fixtureCard(STUN9_SELF, { level: 9, ap: 5000 }),
  fixtureCard(STUN8_OPP, { level: 8, ap: 6000 }),
  fixtureCard(STUN9_OPP, { level: 9, ap: 7000 }),
  fixtureCard(D_STUN5_SELF, { level: 5, ap: 4000 }),
  fixtureCard(D_STUN6_SELF, { level: 6, ap: 5000 }),
  fixtureCard(D_STUN5_OPP, { level: 5, ap: 6000 }),
  fixtureCard(D_ACTIVE5_OPP, { level: 5, ap: 7000 }),
  fixtureCard(D_ALREADY_STUN5_SELF, { level: 5, ap: 3000 }),
  fixtureCard(D_RULE_ACTOR, { level: 9, ap: 9000 }),
];

type LeaveCase = {
  card: CardDef;
  abilityId: string;
  chosen: string;
  included?: string[];
  excluded: string[];
  setup: (state: GameState) => void;
  capture: (state: GameState) => unknown;
  stunRuleActorUid?: string;
};

function qa(card: CardDef): string {
  return `card:${card.id}:${QA_SUFFIX}`;
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

function baseState(spec: LeaveCase, turn: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    makeChar({ cardId: spec.card.id, uid: 'source', state: 'sleep' }),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
  ];
  state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.self.deck = [DECK_TOP, DECK_TAIL];
  spec.setup(state);
  return state;
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

function expectLeaveTrigger(spec: LeaveCase): void {
  expect(current().pendingEffects.find((entry) => (
    entry.source.cardId === spec.card.id
      && entry.source.uid === 'source'
      && entry.source.abilityId === spec.abilityId
      && entry.triggeredBy.hook === 'leave:to-remove'
  )), `${spec.card.id}: exact leave trigger provenance`).toMatchObject({
    source: { cardId: spec.card.id, uid: 'source', abilityId: spec.abilityId, player: 'self' },
    triggeredBy: { hook: 'leave:to-remove' },
  });
}

function pendingPick(spec: LeaveCase) {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${spec.card.id}: public up-to-one pick`).toMatchObject({
    source: { cardId: spec.card.id, abilityId: spec.abilityId },
    nMin: 0,
    nMax: 1,
  });
  return pending!;
}

function resolvePick(spec: LeaveCase, choice: string | null): void {
  const pending = pendingPick(spec);
  const candidate = choice === null
    ? null
    : pending.candidates.find((item) => item.uid === choice || item.cardId === choice);
  if (choice !== null) expect(candidate, `${spec.card.id}: chosen public candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: candidate?.uid ?? null,
  }))).toEqual({ ok: true });
}

function expectSettled(spec: LeaveCase): void {
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${spec.card.id}: terminal advance ${index + 1}`).toEqual({ ok: true });
  }
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${spec.card.id}: no unresolved pick`).toBeNull();
  expect(store.pendingEffectOptional, `${spec.card.id}: no unresolved optional`).toBeNull();
  expect(store.activeActionId, `${spec.card.id}: no open action`).toBeNull();
  expect(current().pendingEffects.filter((entry) => (
    entry.source.cardId === spec.card.id && (entry.state === 'pending' || entry.state === 'resolving')
  )), `${spec.card.id}: no unresolved source effect`).toEqual([]);
}

function pickProof(spec: LeaveCase): unknown {
  const pending = pendingPick(spec);
  const chosen = pending.candidates.some((item) => item.uid === spec.chosen || item.cardId === spec.chosen);
  const inclusions = Object.fromEntries((spec.included ?? [spec.chosen]).map((key) => [
    key,
    pending.candidates.some((item) => item.uid === key || item.cardId === key),
  ]));
  const exclusions = Object.fromEntries(spec.excluded.map((key) => [
    key,
    pending.candidates.some((item) => item.uid === key || item.cardId === key),
  ]));
  return { range: [pending.nMin, pending.nMax], chosen, inclusions, exclusions };
}

function effectSnapshot(state: GameState): unknown {
  return {
    selfScene: state.players.self.scene
      .filter((char) => !['source', 'remover', 'victim'].includes(char.uid))
      .map((char) => ({ uid: char.uid, cardId: char.cardId, state: char.state, ap: read.char.ap(state, char.uid) })),
    oppScene: state.players.opp.scene
      .filter((char) => char.uid !== 'attacker')
      .map((char) => ({ uid: char.uid, cardId: char.cardId, state: char.state, ap: read.char.ap(state, char.uid) })),
    hand: [...state.players.self.hand],
    deck: [...state.players.self.deck],
    remove: state.players.self.remove.filter((cardId) => cardId !== VICTIM && !sourceCards.some((card) => card.id === cardId)),
  };
}

function proveStunRules(spec: LeaveCase): unknown {
  if (!spec.stunRuleActorUid) return null;
  const activated = produce(current(), (draft) => {
    mutate.scene.tryActivate(draft, spec.chosen);
  });
  const actionTarget = dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: spec.stunRuleActorUid,
    targetUid: spec.chosen,
  });
  return {
    activatedState: activated.players.opp.scene.find((char) => char.uid === spec.chosen)?.state,
    actionTarget,
    actionTargetUid: useGameStateStore.getState().gameState?.actionContexts[useGameStateStore.getState().activeActionId ?? '']?.target.uid,
  };
}

function proveSelfTurnNoTrigger(spec: LeaveCase): unknown {
  restartSession('self');
  install(baseState(spec, 'self'));
  const before = effectSnapshot(current());
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  const removal = useGameStateStore.getState().pendingEffectPick;
  expect(removal).toMatchObject({ source: { cardId: B10022.id, abilityId: 'a1' } });
  const source = removal!.candidates.find((item) => item.uid === 'source');
  expect(source).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(removal!, {
    type: 'effectPickResolve', pickedUid: source!.uid,
  }))).toEqual({ ok: true });
  expectSettled(spec);
  return {
    sourceInRemove: current().players.self.remove.includes(spec.card.id),
    effectState: effectSnapshot(current()),
    before,
    triggerCount: current().pendingEffects.filter((entry) => (
      entry.source.cardId === spec.card.id && entry.triggeredBy.hook === 'leave:to-remove'
    )).length,
  };
}

function proveOtherLeaveNoTrigger(spec: LeaveCase): unknown {
  restartSession('self');
  const state = baseState(spec, 'opp');
  state.players.self.scene.push(makeChar({ cardId: VICTIM, uid: 'victim', state: 'sleep' }));
  install(state);
  const before = effectSnapshot(current());
  removeThroughPublicContact('victim');
  expectSettled(spec);
  return {
    sourceOnScene: current().players.self.scene.some((char) => char.uid === 'source'),
    victimInRemove: current().players.self.remove.includes(VICTIM),
    effectState: effectSnapshot(current()),
    before,
    triggerCount: current().pendingEffects.filter((entry) => (
      entry.source.cardId === spec.card.id && entry.triggeredBy.hook === 'leave:to-remove'
    )).length,
  };
}

function prove(spec: LeaveCase): unknown {
  restartSession('self');
  install(baseState(spec, 'opp'));
  removeThroughPublicContact('source');
  expectLeaveTrigger(spec);
  const publicPick = pickProof(spec);
  resolvePick(spec, spec.chosen);
  const positive = spec.capture(current());
  expectSettled(spec);
  const stunRules = proveStunRules(spec);

  restartSession('self');
  install(baseState(spec, 'opp'));
  removeThroughPublicContact('source');
  expectLeaveTrigger(spec);
  const beforeDecline = spec.capture(current());
  resolvePick(spec, null);
  const afterDecline = spec.capture(current());
  expectSettled(spec);

  return {
    publicPick,
    positive,
    stunRules,
    decline: { before: beforeDecline, after: afterDecline },
    selfTurn: proveSelfTurnNoTrigger(spec),
    otherLeaves: proveOtherLeaveNoTrigger(spec),
  };
}

function sceneEntryCapture(state: GameState, matchId: string): unknown {
  const entered = state.players.self.scene.find((char) => char.cardId === matchId);
  return {
    hand: [...state.players.self.hand],
    entered: entered ? { cardId: entered.cardId, state: entered.state } : null,
    sourceRemoveCount: state.players.self.remove.filter((cardId) => cardId === currentSourceId(state)).length,
  };
}

function currentSourceId(state: GameState): string {
  return sourceCards.find((card) => state.players.self.remove.includes(card.id))?.id ?? '';
}

function commonNegative(): unknown {
  return {
    selfTurn: { sourceInRemove: true, effectState: expect.anything(), before: expect.anything(), triggerCount: 0 },
    otherLeaves: { sourceOnScene: true, victimInRemove: true, effectState: expect.anything(), before: expect.anything(), triggerCount: 0 },
  };
}

const B03012_CASE: LeaveCase = {
  card: B03012,
  abilityId: 'a1',
  chosen: KUDO_MATCH,
  excluded: [KUDO_LEVEL_DECOY, KUDO_NAME_DECOY, KUDO_EVENT],
  setup: (state) => { state.players.self.hand = [KUDO_MATCH, KUDO_LEVEL_DECOY, KUDO_NAME_DECOY, KUDO_EVENT]; },
  capture: (state) => sceneEntryCapture(state, KUDO_MATCH),
};

const B04022_CASE: LeaveCase = {
  card: B04022,
  abilityId: 'a1',
  chosen: HATTORI_MATCH,
  excluded: [HATTORI_LEVEL_DECOY, HATTORI_NAME_DECOY, HATTORI_EVENT],
  setup: (state) => { state.players.self.hand = [HATTORI_MATCH, HATTORI_LEVEL_DECOY, HATTORI_NAME_DECOY, HATTORI_EVENT]; },
  capture: (state) => sceneEntryCapture(state, HATTORI_MATCH),
};

function setupSceneTargets(state: GameState, targetState: 'active' | 'sleep' = 'active'): void {
  state.players.self.scene.push(
    makeChar({ cardId: SELF_TARGET, uid: 'self-target', state: 'active' }),
    makeChar({ cardId: SELF_DECOY, uid: 'self-decoy', state: 'active' }),
  );
  state.players.opp.scene.push(
    makeChar({ cardId: OPP_TARGET, uid: 'opp-target', state: targetState }),
    makeChar({ cardId: OPP_DECOY, uid: 'opp-decoy', state: targetState }),
  );
}

function setupStateTargets(
  state: GameState,
  options: {
    selfTarget: { cardId: string; state: 'active' | 'sleep' | 'stun' };
    selfDecoy: { cardId: string; state: 'active' | 'sleep' | 'stun' };
    oppTarget: { cardId: string; state: 'active' | 'sleep' | 'stun' };
    oppDecoy: { cardId: string; state: 'active' | 'sleep' | 'stun' };
    selfExtra?: { cardId: string; state: 'active' | 'sleep' | 'stun' };
  },
): void {
  state.players.self.scene.push(
    makeChar({ cardId: options.selfTarget.cardId, uid: 'self-target', state: options.selfTarget.state }),
    makeChar({ cardId: options.selfDecoy.cardId, uid: 'self-decoy', state: options.selfDecoy.state }),
    ...(options.selfExtra ? [makeChar({ cardId: options.selfExtra.cardId, uid: 'self-extra', state: options.selfExtra.state })] : []),
  );
  state.players.opp.scene.push(
    makeChar({ cardId: options.oppTarget.cardId, uid: 'opp-target', state: options.oppTarget.state }),
    makeChar({ cardId: options.oppDecoy.cardId, uid: 'opp-decoy', state: options.oppDecoy.state }),
  );
}

function targetCapture(state: GameState): unknown {
  return {
    selfTarget: { state: state.players.self.scene.find((char) => char.uid === 'self-target')?.state, ap: read.char.ap(state, 'self-target') },
    selfDecoy: { state: state.players.self.scene.find((char) => char.uid === 'self-decoy')?.state, ap: read.char.ap(state, 'self-decoy') },
    oppTarget: { state: state.players.opp.scene.find((char) => char.uid === 'opp-target')?.state, ap: read.char.ap(state, 'opp-target') },
    oppDecoy: { state: state.players.opp.scene.find((char) => char.uid === 'opp-decoy')?.state, ap: read.char.ap(state, 'opp-decoy') },
    sourceInRemove: sourceCards.some((card) => state.players.self.remove.includes(card.id)),
  };
}

const B03013_CASE: LeaveCase = {
  card: B03013,
  abilityId: 'a1',
  chosen: 'opp-target',
  included: ['self-target', 'opp-target'],
  excluded: [],
  setup: (state) => setupSceneTargets(state),
  capture: targetCapture,
};

const B03091_CASE: LeaveCase = {
  card: B03091,
  abilityId: 'a1',
  chosen: 'self-target',
  excluded: ['self-decoy', 'opp-target', 'opp-decoy'],
  setup: (state) => setupSceneTargets(state),
  capture: targetCapture,
};

const B04010_CASE: LeaveCase = {
  card: B04010,
  abilityId: 'a1',
  chosen: 'opp-target',
  included: ['self-target', 'opp-target'],
  excluded: ['self-decoy', 'opp-decoy'],
  setup: (state) => setupStateTargets(state, {
    selfTarget: { cardId: SLEEP4_SELF, state: 'active' }, selfDecoy: { cardId: SLEEP5_SELF, state: 'active' },
    oppTarget: { cardId: SLEEP4_OPP, state: 'active' }, oppDecoy: { cardId: SLEEP5_OPP, state: 'active' },
  }),
  capture: targetCapture,
};

const B04030_CASE: LeaveCase = {
  card: B04030,
  abilityId: 'a2',
  chosen: 'opp-target',
  included: ['self-target', 'opp-target'],
  excluded: ['self-decoy', 'opp-decoy'],
  setup: (state) => setupStateTargets(state, {
    selfTarget: { cardId: STUN8_SELF, state: 'active' }, selfDecoy: { cardId: STUN9_SELF, state: 'active' },
    oppTarget: { cardId: STUN8_OPP, state: 'sleep' }, oppDecoy: { cardId: STUN9_OPP, state: 'active' },
  }),
  capture: targetCapture,
  stunRuleActorUid: 'self-target',
};

const D03004_CASE: LeaveCase = {
  card: D03004,
  abilityId: 'a1',
  chosen: 'opp-target',
  included: ['self-target', 'opp-target'],
  excluded: ['self-decoy', 'self-extra', 'self-rule-actor', 'opp-decoy'],
  setup: (state) => {
    setupStateTargets(state, {
      selfTarget: { cardId: D_STUN5_SELF, state: 'sleep' }, selfDecoy: { cardId: D_STUN6_SELF, state: 'sleep' },
      oppTarget: { cardId: D_STUN5_OPP, state: 'sleep' }, oppDecoy: { cardId: D_ACTIVE5_OPP, state: 'active' },
      selfExtra: { cardId: D_ALREADY_STUN5_SELF, state: 'stun' },
    });
    state.players.self.scene.push(makeChar({ cardId: D_RULE_ACTOR, uid: 'self-rule-actor', state: 'active' }));
  },
  capture: targetCapture,
  stunRuleActorUid: 'self-rule-actor',
};

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [...sourceCards, B10022, ...fixtureCards].forEach(register);
  registerTriggeredListener();
  restartSession('self');
});

afterEach(() => endMatchSession());

describe('opponent-turn leave scene effects through public dispatch', () => {
  it(qa(B03012), () => {
    const proof = prove(B03012_CASE);
    expect(proof, `${B03012.id}: exact Kudo enters active; decline and wrong timing do nothing`).toMatchObject({
      publicPick: { range: [0, 1], chosen: true, exclusions: { [KUDO_LEVEL_DECOY]: false, [KUDO_NAME_DECOY]: false, [KUDO_EVENT]: false } },
      positive: { hand: [KUDO_LEVEL_DECOY, KUDO_NAME_DECOY, KUDO_EVENT], entered: { cardId: KUDO_MATCH, state: 'active' }, sourceRemoveCount: 1 },
      decline: { before: expect.anything(), after: expect.anything() },
      ...commonNegative(),
    });
    expect(proof).toMatchObject({ decline: { before: (proof as { decline: { before: unknown } }).decline.before, after: (proof as { decline: { before: unknown } }).decline.before }, selfTurn: { effectState: (proof as { selfTurn: { before: unknown } }).selfTurn.before }, otherLeaves: { effectState: (proof as { otherLeaves: { before: unknown } }).otherLeaves.before } });
  });

  it(qa(B04022), () => {
    expect(B04022P.abilities.find((ability) => ability.id === 'a1'), `${B04022.id}: parallel printing keeps the complete a1 contract`).toEqual(B04022.abilities.find((ability) => ability.id === 'a1'));
    const proof = prove(B04022_CASE);
    expect(proof, `${B04022.id}: exact Hattori enters sleeping; decline and wrong timing do nothing`).toMatchObject({
      publicPick: { range: [0, 1], chosen: true, exclusions: { [HATTORI_LEVEL_DECOY]: false, [HATTORI_NAME_DECOY]: false, [HATTORI_EVENT]: false } },
      positive: { hand: [HATTORI_LEVEL_DECOY, HATTORI_NAME_DECOY, HATTORI_EVENT], entered: { cardId: HATTORI_MATCH, state: 'sleep' }, sourceRemoveCount: 1 },
      ...commonNegative(),
    });
    expect(proof).toMatchObject({ decline: { before: (proof as { decline: { before: unknown } }).decline.before, after: (proof as { decline: { before: unknown } }).decline.before }, selfTurn: { effectState: (proof as { selfTurn: { before: unknown } }).selfTurn.before }, otherLeaves: { effectState: (proof as { otherLeaves: { before: unknown } }).otherLeaves.before } });
  });

  it(qa(B03013), () => {
    const proof = prove(B03013_CASE);
    expect(proof, `${B03013.id}: either-side target gets AP-2000 only on own opponent-turn leave`).toMatchObject({
      publicPick: { range: [0, 1], chosen: true, inclusions: { 'self-target': true, 'opp-target': true } },
      positive: { selfTarget: { ap: 4000 }, selfDecoy: { ap: 5000 }, oppTarget: { ap: 4000 }, oppDecoy: { ap: 7000 }, sourceInRemove: true },
      ...commonNegative(),
    });
    expect(proof).toMatchObject({ decline: { before: (proof as { decline: { before: unknown } }).decline.before, after: (proof as { decline: { before: unknown } }).decline.before }, selfTurn: { effectState: (proof as { selfTurn: { before: unknown } }).selfTurn.before }, otherLeaves: { effectState: (proof as { otherLeaves: { before: unknown } }).otherLeaves.before } });
  });

  it(qa(B03091), () => {
    const proof = prove(B03091_CASE);
    expect(proof, `${B03091.id}: only own Police target gets AP+1000`).toMatchObject({
      publicPick: { range: [0, 1], chosen: true, exclusions: { 'self-decoy': false, 'opp-target': false, 'opp-decoy': false } },
      positive: { selfTarget: { ap: 5000 }, selfDecoy: { ap: 5000 }, oppTarget: { ap: 6000 }, oppDecoy: { ap: 7000 }, sourceInRemove: true },
      ...commonNegative(),
    });
    expect(proof).toMatchObject({ decline: { before: (proof as { decline: { before: unknown } }).decline.before, after: (proof as { decline: { before: unknown } }).decline.before }, selfTurn: { effectState: (proof as { selfTurn: { before: unknown } }).selfTurn.before }, otherLeaves: { effectState: (proof as { otherLeaves: { before: unknown } }).otherLeaves.before } });
  });

  it(qa(B04010), () => {
    const proof = prove(B04010_CASE);
    expect(proof, `${B04010.id}: either-side level-4 target sleeps; level-5 decoys stay excluded`).toMatchObject({
      publicPick: { range: [0, 1], chosen: true, inclusions: { 'self-target': true, 'opp-target': true }, exclusions: { 'self-decoy': false, 'opp-decoy': false } },
      positive: { oppTarget: { state: 'sleep' }, selfDecoy: { state: 'active' }, oppDecoy: { state: 'active' }, sourceInRemove: true },
      ...commonNegative(),
    });
    expect(proof).toMatchObject({ decline: { before: (proof as { decline: { before: unknown } }).decline.before, after: (proof as { decline: { before: unknown } }).decline.before }, selfTurn: { effectState: (proof as { selfTurn: { before: unknown } }).selfTurn.before }, otherLeaves: { effectState: (proof as { otherLeaves: { before: unknown } }).otherLeaves.before } });
  });

  it(qa(B04030), () => {
    expect(B04030P.abilities.find((ability) => ability.id === 'a2'), `${B04030.id}: parallel printing keeps the complete a2 contract`).toEqual(B04030.abilities.find((ability) => ability.id === 'a2'));
    const proof = prove(B04030_CASE);
    expect(proof, `${B04030.id}: either-side level-8 target stuns; level-9 decoys stay excluded`).toMatchObject({
      publicPick: { range: [0, 1], chosen: true, inclusions: { 'self-target': true, 'opp-target': true }, exclusions: { 'self-decoy': false, 'opp-decoy': false } },
      positive: { oppTarget: { state: 'stun' }, selfDecoy: { state: 'active' }, oppDecoy: { state: 'active' }, sourceInRemove: true },
      stunRules: { activatedState: 'sleep', actionTarget: { ok: false }, actionTargetUid: undefined },
      ...commonNegative(),
    });
    expect(proof).toMatchObject({ decline: { before: (proof as { decline: { before: unknown } }).decline.before, after: (proof as { decline: { before: unknown } }).decline.before }, selfTurn: { effectState: (proof as { selfTurn: { before: unknown } }).selfTurn.before }, otherLeaves: { effectState: (proof as { otherLeaves: { before: unknown } }).otherLeaves.before } });
  });

  it(qa(D03004), () => {
    const proof = prove(D03004_CASE);
    expect(proof, `${D03004.id}: only sleeping level-5-or-lower target stuns`).toMatchObject({
      publicPick: { range: [0, 1], chosen: true, inclusions: { 'self-target': true, 'opp-target': true }, exclusions: { 'self-decoy': false, 'self-extra': false, 'opp-decoy': false } },
      positive: { selfTarget: { state: 'sleep' }, oppTarget: { state: 'stun' }, oppDecoy: { state: 'active' }, sourceInRemove: true },
      stunRules: { activatedState: 'sleep', actionTarget: { ok: false }, actionTargetUid: undefined },
      ...commonNegative(),
    });
    expect(proof).toMatchObject({ decline: { before: (proof as { decline: { before: unknown } }).decline.before, after: (proof as { decline: { before: unknown } }).decline.before }, selfTurn: { effectState: (proof as { selfTurn: { before: unknown } }).selfTurn.before }, otherLeaves: { effectState: (proof as { otherLeaves: { before: unknown } }).otherLeaves.before } });
  });
});
