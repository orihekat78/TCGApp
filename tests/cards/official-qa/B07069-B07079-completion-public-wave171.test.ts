// qa: card:B07069:2bcb59c4061b4f418e16db29d59e7a70e64ac2d3f6d1648c367d531fdb1d49f9
// qa: card:B07069:cb60b337cf9fa08ed6d72d3d9e3f106430dcff220524204b8eadb5820effdb18
// qa: card:B07069:ddde20ec5993fbd1f7145992a65778a00273a264bfbbb50353e15d348941d97f
// qa: card:B07070:cbb325dcff012450afb4952c83f39a01b09170f5ef8155ed39e023bd6f5a8b20
// qa: card:B07075:8f62d698741bd8b87e040399489a517fa090a5281056cb1f63f399ffe97a6f1d
// qa: card:B07077:e7696529447cdd4105353e743deb4b9055acf506a6063542ebd4b356f440e195
// qa: card:B07079:80a2cfb16a87e5d0d4da8698cb86f47b173740616dd1af4e02537a5deb1ade52
// qa: card:B07079:8b7f821960dd18cf824ea5d63d3ee948f149decdcb8f2ad014f6649089472cdf
// qa: card:B07079:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03129 } from '@/cards/ct-p03/B03129';
import { B07069 } from '@/cards/ct-p07/B07069';
import { B07069P } from '@/cards/ct-p07/B07069P';
import { B07070 } from '@/cards/ct-p07/B07070';
import { B07075 } from '@/cards/ct-p07/B07075';
import { B07077 } from '@/cards/ct-p07/B07077';
import { B07077P } from '@/cards/ct-p07/B07077P';
import { B07079 } from '@/cards/ct-p07/B07079';
import { B07079P } from '@/cards/ct-p07/B07079P';
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
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const RED_PARTNER = fixture('W171_RED_PARTNER', { kind: 'partner', level: undefined, ap: undefined, lp: 1 });
const HAND_RED = fixture('W171_HAND_RED', { level: 5 });
const FILE_RED = fixture('W171_FILE_RED', { level: 6 });
const FILE_FILLER = fixture('W171_FILE_FILLER', { kind: 'event' });
const HAND = fixture('W171_HAND', { kind: 'event' });
const DRAW = fixture('W171_DRAW', { kind: 'event' });
const FILLER = fixture('W171_FILLER', { ap: 2000 });
const RED_L7 = fixture('W171_RED_L7', { level: 7, ap: 7000 });
const ATTACKER = fixture('W171_ATTACKER', { ap: 9000 });
const FBI = fixture('W171_FBI', { traits: ['FBI'] });
const LEVEL8 = fixture('W171_LEVEL8', { level: 8, ap: 5000, lp: 2 });
const LEVEL_PROBE = fixture('W171_LEVEL_PROBE', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 } } },
    description: '相手のレベル7以下を1枚までリムーブ。', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const POLICE_ACTOR = fixture('W171_POLICE_ACTOR', { colors: ['黄'], level: 6, ap: 7000, traits: ['警視庁'] });
const CONTACT_TARGET = fixture('W171_CONTACT_TARGET', { colors: ['青'], ap: 1000 });
const NAMES = ['シェリー', '宮野志保', '宮野明美', '降谷零'] as const;
const NAMED_ROWS = NAMES.flatMap((name, index) => [
  fixture(`W171_NAME_${index}_L5`, { names: [name], level: 5 }),
  fixture(`W171_NAME_${index}_L6`, { names: [name], level: 6 }),
]);
const FIXTURES = [
  RED_PARTNER, HAND_RED, FILE_RED, FILE_FILLER, HAND, DRAW, FILLER, RED_L7,
  ATTACKER, FBI, LEVEL8, LEVEL_PROBE, POLICE_ACTOR, CONTACT_TARGET, ...NAMED_ROWS,
];
const B07069_PRINTS = [B07069, B07069P] as const;
const B07077_PRINTS = [B07077, B07077P] as const;
const B07079_PRINTS = [B07079, B07079P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function fileEntry(cardId: string) {
  return { type: 'card-back' as const, cardId };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave171 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave171-${label}`);
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

function b07069State(card: CardDef, owner: Player, fileCount = 8): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 171, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤'];
  state.players[owner].scene = [
    sceneChar(card.id, 'source', { state: 'active' }),
    ...Array.from({ length: 4 }, (_value, index) => sceneChar(FILLER.id, `filler-${index}`)),
  ];
  state.players[owner].hand = [HAND_RED.id];
  state.players[owner].file = [
    ...Array.from({ length: Math.max(0, fileCount - 1) }, () => fileEntry(FILE_FILLER.id)),
    ...(fileCount > 0 ? [fileEntry(FILE_RED.id)] : []),
  ];
  return state;
}

describe('official QA Wave171: B07069/P pre-cost FILE gate and paid-card re-entry', () => {
  it.each(B07069_PRINTS.flatMap(card => (['self', 'opp'] as const).flatMap(owner => (
    ([HAND_RED.id, FILE_RED.id] as const).map(selectedId => ({ card, owner, selectedId }))
  ))))('$card.id owner=$owner re-enters paid $selectedId through a source-self full-scene switch', ({ card, owner, selectedId }) => {
    install(b07069State(card, owner), owner, `${card.id}-${owner}-${selectedId}`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });

    expect(current().players[owner].file).toHaveLength(7);
    expect(current().players[owner].scene.find(character => character.uid === 'source')?.state).toBe('sleep');
    const entry = pendingPick(card.id, 'a2', 'sceneEnter');
    expect(entry.candidates.map(candidate => candidate.cardId).sort()).toEqual([FILE_RED.id, HAND_RED.id].sort());
    const selected = entry.candidates.find(candidate => candidate.cardId === selectedId)!;
    choose(entry, selected.uid, 'source');

    expect(current().players[owner].scene).toHaveLength(5);
    expect(current().players[owner].scene.some(character => character.cardId === selectedId)).toBe(true);
    expect(current().players[owner].scene.some(character => character.uid === 'source')).toBe(false);
    expect(current().players[owner].remove).toContain(card.id);
    expect(current().players[owner].remove).toContain(selectedId === HAND_RED.id ? FILE_RED.id : HAND_RED.id);
  });

  it.each(B07069_PRINTS)('$id rejects FILE7 atomically but admits FILE8 before paying down to seven', card => {
    const below = b07069State(card, 'self', 7);
    install(below, 'self', `${card.id}-file7`);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);

    install(b07069State(card, 'self', 8), 'self', `${card.id}-file8`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    expect(current().players.self.file).toHaveLength(7);
    expect(useGameStateStore.getState().pendingEffectPick).not.toBeNull();
  });
});

function b07070State(owner: Player, extraHand: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 171, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤'];
  state.players[owner].file = Array.from({ length: 5 }, () => fileEntry(DRAW.id));
  state.players[owner].hand = [B07070.id, ...Array.from({ length: extraHand }, () => HAND.id)];
  state.players[owner].scene = [sceneChar(RED_L7.id, 'red-target')];
  return state;
}

describe('official QA Wave171: B07070 source is removed from hand before its enter condition', () => {
  it.each(['self', 'opp'] as const)('owner=%s sees two remaining cards and triggers, but three do not', owner => {
    install(b07070State(owner, 2), owner, `${owner}-hand-two`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07070.id }))
      .toEqual({ ok: true });
    const pick = pendingPick(B07070.id, 'a1', 'charModifyAP');
    choose(pick, 'red-target');
    expect(read.char.ap(current(), 'red-target')).toBe(8000);
    expect(read.char.keywords(current(), 'red-target')).toContain('突撃');

    install(b07070State(owner, 3), owner, `${owner}-hand-three`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07070.id }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(read.char.ap(current(), 'red-target')).toBe(7000);
  });
});

function removeB07075(owner: Player): void {
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

describe('official QA Wave171: B07075 applies level 5 to every named alternative', () => {
  it.each(['self', 'opp'] as const)('owner=%s includes all four level5 names and excludes all level6 copies', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 171, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07075.id, 'source', { state: 'sleep' })];
    state.players[owner].hand = NAMED_ROWS.map(card => card.id);
    state.players[other(owner)].scene = [sceneChar(ATTACKER.id, 'attacker', { state: 'active' })];
    install(state, owner, `${owner}-all-names`);
    removeB07075(owner);

    const entry = pendingPick(B07075.id, 'a1', 'sceneEnter');
    expect(entry.candidates.map(candidate => candidate.cardId).sort())
      .toEqual(NAMED_ROWS.filter(card => card.level === 5).map(card => card.id).sort());
    const selected = entry.candidates[0]!;
    choose(entry, selected.uid);
    expect(current().players[owner].scene.find(character => character.cardId === selected.cardId)?.state)
      .toBe('sleep');
  });
});

function evidence(cardId: string) {
  return { cardId, faceUp: false, origin: { turn: 1, via: 'effect' as const } };
}

describe('official QA Wave171: B07077/P level reduction changes later references only', () => {
  it.each(B07077_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner changes effective level 8 to 7 without changing AP, LP, or state',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 171, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case = { ...state.players[owner].case, cardId: card.id, status: '解決編' };
      state.players[owner].evidence = [evidence(DRAW.id)];
      state.players[owner].scene = [sceneChar(FBI.id, 'fbi'), sceneChar(LEVEL_PROBE.id, 'probe')];
      state.players[other(owner)].scene = [sceneChar(LEVEL8.id, 'level-target', { state: 'sleep' })];
      install(state, owner, `${card.id}-${owner}-level`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { flipFaceUpEvidence: { indices: [0] } },
      }), 'B07077/B07077P level reduction').toEqual({ ok: true });
      choose(pendingPick(card.id, 'a2', 'charModifyLevel'), 'level-target');
      expect(read.char.level(current(), 'level-target')).toBe(7);
      expect(read.char.ap(current(), 'level-target')).toBe(5000);
      expect(read.char.lp(current(), 'level-target')).toBe(2);
      expect(current().players[other(owner)].scene.find(character => character.uid === 'level-target')?.state).toBe('sleep');

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'probe', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      const later = pendingPick(LEVEL_PROBE.id, 'a1', 'sceneRemove');
      expect(later.candidates.map(candidate => candidate.uid)).toContain('level-target');
      choose(later, null);
      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      expect(read.char.level(current(), 'level-target')).toBe(8);
    },
  );
});

function b07079State(card: CardDef, owner: Player, ownerHand = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 171, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active', isNamed: false })];
  if (ownerHand) state.players[owner].hand = [HAND.id];
  state.players[other(owner)].hand = [HAND.id];
  return state;
}

describe('official QA Wave171: B07079/P self-selection and owner hand cost', () => {
  it.each(B07079_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner pays its own hand and may select itself',
    ({ card, owner }) => {
      install(b07079State(card, owner), owner, `${card.id}-${owner}-self`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });
      const pick = pendingPick(card.id, 'a2', 'charModifyAP');
      expect(pick.candidates.map(candidate => candidate.uid)).toContain('source');
      choose(pick, 'source');
      expect(read.char.ap(current(), 'source')).toBe(11000);
      expect(current().players[owner].scene.find(character => character.uid === 'source')?.turnEffects.toDeckBottomOnTurnEnd)
        .toBe(true);
      expect(current().players[owner].remove).toContain(HAND.id);
      expect(current().players[other(owner)].hand).toEqual([HAND.id]);
    },
  );

  it.each(B07079_PRINTS)('$id rejects an opponent-only hand atomically', card => {
    install(b07079State(card, 'self', false), 'self', `${card.id}-opponent-only`);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });
});

function reachActorWindow(): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'contact-target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave171 contact ended before actor window');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
      if (player === 'self' && uid === 'actor') return actionId;
      expect(dispatchEngineAction({ type: 'actionContact', actionId, player, choice: { kind: 'pass' } }))
        .toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave171 actor window not reached');
}

describe('official QA Wave171: B07079/P granted effects survive Disguise', () => {
  it.each(B07079_PRINTS)('$id grant transfers to the disguise face and moves it to deck bottom at turn end', card => {
    const state = createEmptyGameState();
    state.turn = { number: 171, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.file = Array.from({ length: 6 }, () => fileEntry(DRAW.id));
    state.players.self.scene = [sceneChar(card.id, 'source'), sceneChar(POLICE_ACTOR.id, 'actor', { state: 'active', isNamed: false })];
    state.players.self.hand = [HAND.id, B03129.id];
    state.players.opp.scene = [sceneChar(CONTACT_TARGET.id, 'contact-target', { state: 'sleep' })];
    state.players.self.deck = [DRAW.id];
    install(state, 'self', `${card.id}-disguise-transfer`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    choose(pendingPick(card.id, 'a2', 'charModifyAP'), 'actor');
    expect(read.char.ap(current(), 'actor')).toBe(10000);

    const actionId = reachActorWindow();
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'disguise', cardId: B03129.id },
    })).toEqual({ ok: true });
    expect(current().players.self.scene.find(character => character.uid === 'actor')?.cardId).toBe(B03129.id);
    expect(read.char.ap(current(), 'actor')).toBe(B03129.ap! + 3000);
    expect(current().players.self.scene.find(character => character.uid === 'actor')?.turnEffects.toDeckBottomOnTurnEnd)
      .toBe(true);

    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    const action = flow.action._getContext(current(), actionId);
    if (action?.phase === 'action-1-redo') {
      expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } }))
        .toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(current().players.self.scene.some(character => character.uid === 'actor')).toBe(false);
    expect(current().players.self.deck.at(-1)).toBe(B03129.id);
  });
});
