// qa: card:B07085:e8eb38fe4adaf20641339946d8691e2339623fbc925878d38fa4bcb0480efe04
// qa: card:B07086:7abbda9f6c4aee2aa0ad9fd71d76c0d34d31d65e95d7ba3c9aff18fa28b50685
// qa: card:B07086:e48a48649cfda60bc28903ebc1518bb105233d40c914928cb4fc9fb9512eb761
// qa: card:B07087:28660457e46b234b8eda0f8ef2c6f3353a37a1739cfebe4112b7bfffed415436
// qa: card:B07089:81ca9d0c5d233174bf01264f196d510093f955d83f34d6820d51b61c7c0115ea
// qa: card:B07089:afdfa29ef9d37fb3d7f64c83971c1be3ed05d097be37abc3af51040b837b7930
// qa: card:B07090:4d1fa98c33395da54f8574029ff3dab24cda9c8ead57684afaaaa815380793d3
// qa: card:B07090:fd26643fba75dc78066866fd0c928d26a3d552e334eb9f5e5dcc4d3a370e93c4
// qa: card:B07091:56f3c2b01964a22d3ae9c0b6638173ede31f155b90a1d262161ca887bdd0a968
// qa: card:B07091:b0ef1b9d2e03f39626615f5aece59ba7305ff0e0b970f184a230f38b4818c9a5
// qa: card:B07091:ea52bf910c2f5c6a0e7424d4e7cb78e29dbd541ebed373ffdff0ef0bbb3e9a52

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07085 } from '@/cards/ct-p07/B07085';
import { B07086 } from '@/cards/ct-p07/B07086';
import { B07087 } from '@/cards/ct-p07/B07087';
import { B07087P } from '@/cards/ct-p07/B07087P';
import { B07089 } from '@/cards/ct-p07/B07089';
import { B07090 } from '@/cards/ct-p07/B07090';
import { B07090P } from '@/cards/ct-p07/B07090P';
import { B07091 } from '@/cards/ct-p07/B07091';
import { B07091P } from '@/cards/ct-p07/B07091P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const POIROT_ACTOR = fixture('W172_POIROT_ACTOR', { traits: ['喫茶ポアロ'], ap: 1000 });
const CONTACT_WALL = fixture('W172_CONTACT_WALL', { ap: 10000 });
const ATTACKER = fixture('W172_ATTACKER', { ap: 9000 });
const AZUSA_FIRST = fixture('W172_AZUSA_FIRST', { names: ['榎本梓'] });
const AZUSA_LATER = fixture('W172_AZUSA_LATER', { names: ['榎本梓'] });
const REVEAL_DECOY = fixture('W172_REVEAL_DECOY', { kind: 'event' });
const TAIL = fixture('W172_TAIL', { kind: 'event' });
const HAND_KEEP = fixture('W172_HAND_KEEP', { kind: 'event' });
const FILE_CARD = fixture('W172_FILE_CARD', { kind: 'event' });
const DRAW = fixture('W172_DRAW', { kind: 'event' });
const REFRESH_CARD = fixture('W172_REFRESH_CARD', { kind: 'event' });
const POLICE_REVEAL = fixture('W172_POLICE_REVEAL', { traits: ['警察'] });
const POLICE_ACTOR = fixture('W172_POLICE_ACTOR', { traits: ['警視庁'], level: 4, ap: 1000 });
const POLICE_ENTRY = fixture('W172_POLICE_ENTRY', { traits: ['警視庁'], level: 5, ap: 3000 });
const ACTIVE_TARGET = fixture('W172_ACTIVE_TARGET', { ap: 10000 });
const POLICE_TARGET = fixture('W172_POLICE_TARGET', { traits: ['警視庁'], ap: 5000 });
const EVIDENCE_A = fixture('W172_EVIDENCE_A', { kind: 'event' });
const EVIDENCE_B = fixture('W172_EVIDENCE_B', { kind: 'event' });
const EVIDENCE_C = fixture('W172_EVIDENCE_C', { kind: 'event' });
const EVIDENCE_D = fixture('W172_EVIDENCE_D', { kind: 'event' });
const FIXTURES = [
  POIROT_ACTOR, CONTACT_WALL, ATTACKER, AZUSA_FIRST, AZUSA_LATER, REVEAL_DECOY,
  TAIL, HAND_KEEP, FILE_CARD, DRAW, REFRESH_CARD, POLICE_REVEAL, POLICE_ACTOR,
  POLICE_ENTRY, ACTIVE_TARGET, POLICE_TARGET, EVIDENCE_A, EVIDENCE_B, EVIDENCE_C, EVIDENCE_D,
];
const B07087_PRINTS = [B07087, B07087P] as const;
const B07090_PRINTS = [B07090, B07090P] as const;
const B07091_PRINTS = [B07091, B07091P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave172 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave172-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(
  pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>,
  pickedUid: string | null,
  switchRemoveUid?: string,
): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: FILE_CARD.id }));
}

function evidence(cardId: string, faceUp = false) {
  return { cardId, faceUp, origin: { turn: 1, via: 'effect' as const } };
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave172: B07085 counts only scene Poirot characters', () => {
  it.each(['self', 'opp'] as const)('owner=%s excludes the Cut-In card still in hand from its AP count', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 172, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].hand = [B07085.id];
    state.players[owner].scene = [sceneChar(POIROT_ACTOR.id, 'actor', { state: 'active' })];
    state.players[other(owner)].scene = [sceneChar(CONTACT_WALL.id, 'target', { state: 'sleep' })];
    install(state, owner, `${owner}-cutin-scene-count`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId: B07085.id },
    })).toEqual({ ok: true });

    expect(read.char.ap(current(), 'actor'), 'B07085 hand source is not a scene Poirot').toBe(2000);
    expect(current().players[owner].remove).toContain(B07085.id);
  });
});

function removeB07086ByContact(owner: Player): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

function b07086State(owner: Player, deck: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 172, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(B07086.id, 'source', { state: 'sleep' })];
  state.players[owner].hand = [HAND_KEEP.id];
  state.players[owner].deck = [...deck];
  state.players[other(owner)].scene = [sceneChar(ATTACKER.id, 'attacker', { state: 'active' })];
  return state;
}

describe('official QA Wave172: B07086 forced first match and no-match shuffle', () => {
  it.each(['self', 'opp'] as const)('owner=%s takes the first Azusa with no decline path', owner => {
    install(
      b07086State(owner, [REVEAL_DECOY.id, AZUSA_FIRST.id, AZUSA_LATER.id, TAIL.id]),
      owner,
      `${owner}-forced-first-azusa`,
    );
    removeB07086ByContact(owner);
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, visibility: 'public', viewer: 'all',
      revealed: [REVEAL_DECOY.id, AZUSA_FIRST.id], matched: AZUSA_FIRST.id,
      source: { cardId: B07086.id, abilityId: 'a2' },
    });
    expect(useGameStateStore.getState().pendingEffectOptional, 'B07086 first match is mandatory').toBeNull();
    const discard = pendingPick(B07086.id, 'a2', 'discard');
    expect(discard.candidates.map(candidate => candidate.cardId).sort())
      .toEqual([HAND_KEEP.id, AZUSA_FIRST.id].sort());
    choose(discard, discard.candidates.find(candidate => candidate.cardId === HAND_KEEP.id)!.uid);

    expect(current().players[owner].hand, 'B07086 first matching Azusa enters hand').toEqual([AZUSA_FIRST.id]);
    expect(current().players[owner].deck).toContain(AZUSA_LATER.id);
    expect(current().players[owner].remove).toEqual(expect.arrayContaining([B07086.id, HAND_KEEP.id]));
  });

  it.each(['self', 'opp'] as const)('owner=%s restores and shuffles all cards without discarding on no match', owner => {
    const deck = [REVEAL_DECOY.id, TAIL.id];
    install(b07086State(owner, deck), owner, `${owner}-no-azusa`);
    removeB07086ByContact(owner);
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, revealed: deck, matched: null,
      source: { cardId: B07086.id, abilityId: 'a2' },
    });
    expect(current().players[owner].hand, 'B07086 no-match does not discard').toEqual([HAND_KEEP.id]);
    expect([...current().players[owner].deck].sort()).toEqual([...deck].sort());
    expect(current().players[owner].remove).toEqual([B07086.id]);
    expect(current().log.some(entry => entry.action === 'effect:deckShuffle')).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

describe('official QA Wave172: B07087/P may select the declaring source', () => {
  it.each(B07087_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner selects itself through declaredAbility',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 172, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active' })];
      install(state, owner, `${card.id}-${owner}-self`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      const pick = pendingPick(card.id, 'a1', 'charModifyAP');
      expect(pick.candidates.map(candidate => candidate.uid), 'B07087/B07087P source is eligible')
        .toContain('source');
      choose(pick, 'source');
      expect(read.char.ap(current(), 'source')).toBe(6000);
    },
  );
});

describe('official QA Wave172: B07089 reveals the final card before refresh and must take a match', () => {
  it.each(['self', 'opp'] as const)('owner=%s reveals and takes the sole Police card before refresh', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 172, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07089.id, 'source', { state: 'active' })];
    state.players[owner].deck = [POLICE_REVEAL.id];
    state.players[owner].remove = [REFRESH_CARD.id];
    install(state, owner, `${owner}-last-card`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingDeckReveal, 'B07089 final card is revealed before refresh')
      .toMatchObject({ player: owner, revealed: [POLICE_REVEAL.id], matched: POLICE_REVEAL.id });
    expect(current().players[owner].hand, 'B07089 qualifying character is mandatory to hand')
      .toEqual([POLICE_REVEAL.id]);
    expect(current().refreshCount[owner]).toBe(1);
    expect(current().players[owner].deck).toEqual([REFRESH_CARD.id]);
    expect(current().players[owner].remove).toEqual([]);
    const actions = current().log.map(entry => entry.action);
    expect(actions.lastIndexOf('refresh')).toBeGreaterThan(actions.lastIndexOf('effect:deckRevealUntil'));
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

function b07090State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 172, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['黄'];
  state.players[owner].file = fileCards(card.level ?? 0);
  state.players[owner].hand = [card.id];
  state.players[owner].scene = [sceneChar(POLICE_ACTOR.id, 'police', { state: 'active', isNamed: false })];
  state.players[owner].remove = [POLICE_ENTRY.id];
  state.players[owner].deck = Array.from({ length: 10 }, () => DRAW.id);
  state.players[other(owner)].scene = [sceneChar(ACTIVE_TARGET.id, 'active-target', { state: 'active' })];
  state.players[other(owner)].deck = Array.from({ length: 10 }, () => DRAW.id);
  return state;
}

function finishLowActorContact(owner: Player, actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

describe('official QA Wave172: B07090/P independent branches and turn-end expiry', () => {
  it.each(B07090_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner declines entry, grants active targeting, then loses the whole grant at turn end',
    ({ card, owner }) => {
      install(b07090State(card, owner), owner, `${card.id}-${owner}-grant-only`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });

      choose(pendingPick(card.id, 'a1', 'sceneEnter'), null);
      const grant = pendingPick(card.id, 'a1', 'charModifyAP');
      expect(grant.candidates.map(candidate => candidate.uid)).toContain('police');
      choose(grant, 'police');
      expect(read.char.ap(current(), 'police')).toBe(2000);
      expect(current().players[owner].scene.find(character => character.uid === 'police')?.turnEffects.actionTargetsActive)
        .toBe(true);

      expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'police', targetUid: 'active-target' }),
        'B07090/B07090P granted active target is usable').toEqual({ ok: true });
      finishLowActorContact(owner, useGameStateStore.getState().activeActionId!);
      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'endTurn', player: other(owner) })).toEqual({ ok: true });
      expect(current().turn.player).toBe(owner);
      expect(read.char.ap(current(), 'police'), 'B07090/B07090P AP grant expires').toBe(1000);
      expect(current().players[owner].scene.find(character => character.uid === 'police')?.turnEffects.actionTargetsActive)
        .not.toBe(true);
      expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'police', targetUid: 'active-target' }))
        .toEqual({ ok: false, reason: 'not-allowed' });
    },
  );

  it.each(B07090_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner enters from remove while independently declining the Police grant',
    ({ card, owner }) => {
      const state = b07090State(card, owner);
      state.players[owner].scene = [];
      install(state, owner, `${card.id}-${owner}-entry-only`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });

      const entry = pendingPick(card.id, 'a1', 'sceneEnter');
      const entrant = entry.candidates.find(candidate => candidate.cardId === POLICE_ENTRY.id)!;
      choose(entry, entrant.uid);
      const grant = pendingPick(card.id, 'a1', 'charModifyAP');
      expect(grant.candidates.map(candidate => candidate.cardId)).toContain(POLICE_ENTRY.id);
      choose(grant, null);

      const entered = current().players[owner].scene.find(character => character.cardId === POLICE_ENTRY.id)!;
      expect(entered).toBeTruthy();
      expect(read.char.ap(current(), entered.uid), 'B07090/B07090P entry branch survives grant decline').toBe(3000);
      expect(entered.turnEffects.actionTargetsActive).not.toBe(true);
    },
  );
});

function b07091State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 172, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case,
    cardId: card.id,
    status: '解決編',
    declaredUseCount: {},
  };
  state.players[owner].evidence = [
    evidence(EVIDENCE_A.id), evidence(EVIDENCE_B.id, true),
    evidence(EVIDENCE_C.id), evidence(EVIDENCE_D.id),
  ];
  state.players[other(owner)].evidence = [evidence(EVIDENCE_A.id)];
  state.players[other(owner)].scene = [sceneChar(POLICE_TARGET.id, 'police-target')];
  return state;
}

describe('official QA Wave172: B07091/P arbitrary own evidence cost preserves order and scales AP', () => {
  it.each(B07091_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner flips three noncontiguous own positions without reordering and grants AP+3000',
    ({ card, owner }) => {
      install(b07091State(card, owner), owner, `${card.id}-${owner}-three-evidence`);
      const beforeIds = current().players[owner].evidence.map(item => item.cardId);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { flipFaceUpEvidence: { indices: [3, 0, 2] } },
      })).toEqual({ ok: true });
      const pick = pendingPick(card.id, 'a2', 'charModifyAP');
      expect(pick.candidates.map(candidate => candidate.uid)).toContain('police-target');
      choose(pick, 'police-target');

      expect(current().players[owner].evidence.map(item => item.cardId), 'B07091/B07091P evidence order')
        .toEqual(beforeIds);
      expect(current().players[owner].evidence.map(item => item.faceUp)).toEqual([true, true, true, true]);
      expect(current().players[other(owner)].evidence[0]?.faceUp, 'B07091/B07091P opponent evidence untouched')
        .toBe(false);
      expect(read.char.ap(current(), 'police-target'), 'B07091/B07091P +1000 per three paid evidence')
        .toBe(8000);
    },
  );

  it.each(B07091_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner cannot substitute the opponent face-down evidence for its cost',
    ({ card, owner }) => {
      const state = b07091State(card, owner);
      state.players[owner].evidence = [evidence(EVIDENCE_A.id, true)];
      install(state, owner, `${card.id}-${owner}-opponent-only`);
      const before = JSON.stringify(current());
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { flipFaceUpEvidence: { indices: [0] } },
      }), 'B07091/B07091P owner-only evidence cost').toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);
    },
  );
});
