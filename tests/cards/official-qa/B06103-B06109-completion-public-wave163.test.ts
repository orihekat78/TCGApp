// qa: card:B06103:06421f8b3e73fe7e22aaac43188049be0f09de4bd944b4069b0a1c84ffcd7102
// qa: card:B06103:39f1c14b17c896de002441eedc381447fd981ccfbc3a113402954cf4b89f23d2
// qa: card:B06103:dae02fc940ddff850db5b2535ec40ecb446e33833474a6114667f1fd14600790
// qa: card:B06105:cef19acafddb85d5e9ebc2616e6fb4f08209d73a51409805a085cd196de080e5
// qa: card:B06105:ef8f1c5c8c1abdc6f70dd0cbdf073b3d8c558f5feeca4c12d99122b337875843
// qa: card:B06109:0344326f0d096542a20d08638ac7053181e88bdbe689d4c051caf0b6bac71225
// qa: card:B06109:d0d507837dc0c22afe4230aae4e7bc09551a213d037f02ea876c29a982a8b289

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06103 } from '@/cards/ct-p06/B06103';
import { B06103P } from '@/cards/ct-p06/B06103P';
import { B06105 } from '@/cards/ct-p06/B06105';
import { B06105P } from '@/cards/ct-p06/B06105P';
import { B06109 } from '@/cards/ct-p06/B06109';
import { B06109P } from '@/cards/ct-p06/B06109P';
import { D06003 } from '@/cards/ct-d06/D06003';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, EvidenceCard, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
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

function ginEnterer(cardId: string): CardDef {
  return fixture(`W163_ENTER_${cardId}`, {
    abilities: [{
      id: 'a1', type: 'declared', scope: 'on-scene',
      effect: {
        kind: 'atom', verb: 'sceneEnter',
        args: { player: 'self', cardId, from: 'hand', viaEffect: true },
      },
      description: 'Effect-enter the selected Gin printing.', ruleRefs: ['rules/15-abilities-effects.md'],
    }],
  });
}

const BLACK_COST = fixture('W163_BLACK_COST', { colors: ['黒'] });
const CONTACT_ACTOR = fixture('W163_CONTACT_ACTOR', { ap: 3000 });
const CONTACT_TARGET = fixture('W163_CONTACT_TARGET', { ap: 2000 });
const ACTION_ACTOR = fixture('W163_ACTION_ACTOR', { ap: 5000 });
const DRAW = fixture('W163_DRAW', { kind: 'event' });
const FILE_CARD = fixture('W163_FILE', { kind: 'event' });
const ENTER_B06103 = ginEnterer(B06103.id);
const ENTER_B06103P = ginEnterer(B06103P.id);
const GIN_ICONS = fixture('W163_GIN_ICONS', {
  names: ['ジン'], colors: ['黒'],
  abilities: [
    {
      id: 'cutin', type: 'triggered', scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
      description: '【カットイン】AP＋1000', ruleRefs: ['rules/09-cutin-disguise.md'],
    },
    {
      id: 'hirameki', type: 'triggered', scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '【ヒラメキ】カードを1枚引く。', ruleRefs: ['rules/10-action-event.md'],
    },
  ] satisfies AbilityDef[],
});
const LVL6 = fixture('W163_LVL6', { level: 6 });
const LVL7 = fixture('W163_LVL7', { level: 7 });
const EV_A = fixture('W163_EV_A', { kind: 'event' });
const EV_B = fixture('W163_EV_B', { kind: 'event' });
const EV_C = fixture('W163_EV_C', { kind: 'event' });
const EV_D = fixture('W163_EV_D', { kind: 'event' });
const EV_E = fixture('W163_EV_E', { kind: 'event' });
const NON_HIGH = fixture('W163_NON_HIGH', { traits: ['探偵'], colors: ['白'] });
const HIGH_SCHOOL = fixture('W163_HIGH_SCHOOL', { traits: ['高校生'], colors: ['白'] });
const ALLOWED_EVENT = fixture('W163_ALLOWED_EVENT', { kind: 'event', colors: ['白'] });
const NON_HIGH_ENTERER = fixture('W163_NON_HIGH_ENTERER', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: { player: 'self', cardId: NON_HIGH.id, from: 'hand', viaEffect: true },
    },
    description: 'Effect-enter a non-high-school character.', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const NON_HIGH_CUTIN = fixture('W163_NON_HIGH_CUTIN', {
  traits: ['探偵'], colors: ['白'],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    description: '【カットイン】AP＋1000', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const NON_HIGH_DISGUISE = fixture('W163_NON_HIGH_DISGUISE', {
  traits: ['探偵'], colors: ['白'],
  abilities: [{
    id: 'a1', type: 'icon-disguise',
    description: '【変装】', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const NON_HIGH_HIRAMEKI = fixture('W163_NON_HIGH_HIRAMEKI', {
  traits: ['探偵'], colors: ['白'],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【ヒラメキ】カードを1枚引く。', ruleRefs: ['rules/10-action-event.md'],
  }],
});
const FIXTURES = [
  BLACK_COST, CONTACT_ACTOR, CONTACT_TARGET, ACTION_ACTOR, DRAW, FILE_CARD,
  ENTER_B06103, ENTER_B06103P, GIN_ICONS, LVL6, LVL7, EV_A, EV_B, EV_C, EV_D, EV_E,
  NON_HIGH, HIGH_SCHOOL, ALLOWED_EVENT, NON_HIGH_ENTERER, NON_HIGH_CUTIN,
  NON_HIGH_DISGUISE, NON_HIGH_HIRAMEKI,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' } };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave163 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave163-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function ginState(card: CardDef, owner: Player, extraHand: string[] = [], extraScene: string[] = []): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 163, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.status = '解決編';
  state.players[owner].case.colors = ['黒'];
  state.players[owner].hand = [card.id, ...extraHand];
  state.players[owner].scene = [sceneChar(BLACK_COST.id, 'black-cost')];
  extraScene.forEach((cardId, index) => state.players[owner].scene.push(sceneChar(cardId, `extra-scene-${index}`)));
  state.players[owner].file = Array.from({ length: 8 }, () => ({ type: 'card-back' as const, cardId: FILE_CARD.id }));
  state.players[owner].deck = [DRAW.id, EV_A.id, EV_B.id];
  state.players[other(owner)].deck = [EV_C.id, EV_D.id, EV_E.id];
  return state;
}

function declareHandAbility(owner: Player, index = 0) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: `hand:${owner}:${index}`, abilId: 'a1',
    abilityOrigin: 'printed', abilityIndex: 0,
  });
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
}

function reachContactWindow(owner: Player): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'contact-actor', targetUid: 'contact-target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave163 contact ended before owner action window');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = ownerOf(uid!);
      if (player === owner && uid === 'contact-actor') return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave163 owner contact window not reached');
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
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

describe('official QA Wave163: B06103/P named use and entry ban', () => {
  it.each([B06103, B06103P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner blocks normal use, Next Hint, and effect entry',
    ({ card, owner }) => {
      const enterer = card.id === B06103.id ? ENTER_B06103 : ENTER_B06103P;
      install(ginState(card, owner, [card.id], [enterer.id]), owner, `${card.id}-${owner}-ban-routes`);
      expect(declareHandAbility(owner)).toEqual({ ok: true });
      expect(current().turnState[owner].useEnterBannedCardNames).toEqual(['ジン']);

      const beforeHand = current();
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(beforeHand);
      expect(dispatchEngineAction({ type: 'nextHint', player: owner, optionalCardId: card.id }))
        .toEqual({ ok: false, reason: 'not-allowed' });

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'extra-scene-0', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      expect(current().players[owner].hand, 'B06103/B06103P effect-entry ban').toEqual([card.id]);
      expect(current().players[owner].scene.filter(character => character.cardId === card.id)).toHaveLength(1);
    },
  );

  it.each([B06103, B06103P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may declare again, pays the departing source, but cannot re-enter',
    ({ card, owner }) => {
      install(ginState(card, owner, [card.id]), owner, `${card.id}-${owner}-repeat-declare`);
      expect(declareHandAbility(owner)).toEqual({ ok: true });
      expect(current().players[owner].hand).toEqual([card.id]);
      expect(current().players[owner].scene.filter(character => character.cardId === card.id)).toHaveLength(1);

      expect(declareHandAbility(owner)).toEqual({ ok: true });
      expect(current().players[owner].scene.filter(character => character.cardId === card.id)).toEqual([]);
      expect(current().players[owner].remove.filter(cardId => cardId === card.id)).toHaveLength(1);
      expect(current().players[owner].hand, 'B06103/B06103P declaration remains usable under its ban').toEqual([card.id]);
      expect(current().turnState[owner].useEnterBannedCardNames).toEqual(['ジン']);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: false, reason: 'not-allowed' });
    },
  );

  it.each([B06103, B06103P])('$id ban does not prevent a Gin Cut-In', card => {
    const state = ginState(card, 'self', [GIN_ICONS.id], [CONTACT_ACTOR.id]);
    state.players.opp.scene = [sceneChar(CONTACT_TARGET.id, 'contact-target', { state: 'sleep' })];
    state.players.self.scene.find(character => character.cardId === CONTACT_ACTOR.id)!.uid = 'contact-actor';
    install(state, 'self', `${card.id}-cutin-exempt`);
    expect(declareHandAbility('self')).toEqual({ ok: true });

    const actionId = reachContactWindow('self');
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self',
      choice: { kind: 'cutin', cardId: GIN_ICONS.id },
    })).toEqual({ ok: true });
    expect(read.char.ap(current(), 'contact-actor'), 'B06103 Gin Cut-In exemption').toBe(4000);
    expect(current().players.self.remove).toContain(GIN_ICONS.id);
  });

  it('does not suppress a Gin Hirameki', () => {
    const state = createEmptyGameState();
    state.turn = { number: 163, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.turnState.self.useEnterBannedCardNames = ['ジン'];
    state.players.self.evidence = [evidence(GIN_ICONS.id)];
    state.players.self.deck = [DRAW.id, EV_A.id];
    state.players.opp.scene = [sceneChar(ACTION_ACTOR.id, 'action-actor')];
    state.players.opp.deck = [EV_B.id, EV_C.id];
    install(state, 'self', 'B06103-hirameki-exempt');

    expect(dispatchEngineAction({
      type: 'actionDeclareCase', byUid: 'action-actor', targetPlayer: 'self',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
      player: 'self', cardId: GIN_ICONS.id,
    });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    expect(current().players.self.hand, 'B06103 Gin Hirameki exemption').toEqual([DRAW.id]);
  });
});

describe('official QA Wave163: B06105/P exact evidence and mandatory draw', () => {
  it.each([B06105, B06105P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))('$card.id owner=$owner', ({ card, owner }) => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 163, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.cardId = card.id;
    state.players[owner].case.status = '解決編';
    state.players[owner].evidence = [
      evidence(EV_A.id), evidence(EV_B.id), evidence(EV_C.id), evidence(EV_D.id), evidence(EV_E.id),
    ];
    state.players[owner].deck = [DRAW.id, EV_A.id];
    state.players[opponent].hand = [LVL6.id];
    install(state, owner, `${card.id}-${owner}-exact-three`);

    const identities = structuredClone(current().players[owner].evidence.map(item => ({
      cardId: item.cardId, origin: item.origin,
    })));
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { flipFaceUpEvidence: { indices: [0, 2, 4] } },
    })).toEqual({ ok: true });

    expect(current().players[owner].evidence.map(item => item.faceUp), 'B06105/B06105P arbitrary positions')
      .toEqual([true, false, true, false, true]);
    expect(current().players[owner].evidence.map(item => ({ cardId: item.cardId, origin: item.origin })))
      .toEqual(identities);
    expect(current().players[opponent].remove).toEqual([LVL6.id]);
    expect(current().players[owner].hand, 'B06105/B06105P mandatory low-level draw').toEqual([DRAW.id]);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each([B06105, B06105P])('$id does not draw after a level-seven discard', card => {
    const state = createEmptyGameState();
    state.turn = { number: 163, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.cardId = card.id;
    state.players.self.case.status = '解決編';
    state.players.self.evidence = [evidence(EV_A.id), evidence(EV_B.id), evidence(EV_C.id)];
    state.players.self.deck = [DRAW.id];
    state.players.opp.hand = [LVL7.id];
    install(state, 'self', `${card.id}-level-seven`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'case:self', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { flipFaceUpEvidence: { indices: [0, 1, 2] } },
    })).toEqual({ ok: true });
    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.deck).toEqual([DRAW.id]);
  });
});

function b06109State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 163, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.cardId = card.id;
  state.players[owner].case.colors = [...card.colors];
  state.players[owner].case.status = '事件編';
  state.players[owner].file = Array.from({ length: 3 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  return state;
}

describe('official QA Wave163: B06109/P restricts only normal character hand use', () => {
  it.each([B06109, B06109P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner permits events and effect entry while blocking normal/Next-Hint use',
    ({ card, owner }) => {
      const state = b06109State(card, owner);
      state.players[owner].scene = [sceneChar(NON_HIGH_ENTERER.id, 'non-high-enterer')];
      state.players[owner].hand = [NON_HIGH.id, ALLOWED_EVENT.id];
      install(state, owner, `${card.id}-${owner}-route-boundary`);

      const before = current();
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: NON_HIGH.id }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(dispatchEngineAction({ type: 'nextHint', player: owner, optionalCardId: NON_HIGH.id }))
        .toEqual({ ok: false, reason: 'not-allowed' });

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: ALLOWED_EVENT.id }), 'B06109/B06109P event exemption')
        .toEqual({ ok: true });
      expect(current().players[owner].remove).toContain(ALLOWED_EVENT.id);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'non-high-enterer', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      expect(current().players[owner].scene.some(character => character.cardId === NON_HIGH.id), 'B06109 effect-entry exemption')
        .toBe(true);
    },
  );

  it.each([B06109, B06109P].flatMap(card => (
    ['cutin', 'disguise'] as const
  ).map(route => ({ card, route }))))('$card.id permits a non-high-school $route', ({ card, route }) => {
    const state = b06109State(card, 'self');
    state.players.self.scene = [sceneChar(CONTACT_ACTOR.id, 'contact-actor')];
    state.players.opp.scene = [sceneChar(CONTACT_TARGET.id, 'contact-target', { state: 'sleep' })];
    state.players.self.hand = [route === 'cutin' ? NON_HIGH_CUTIN.id : NON_HIGH_DISGUISE.id];
    install(state, 'self', `${card.id}-${route}-exemption`);

    const actionId = reachContactWindow('self');
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self',
      choice: route === 'cutin'
        ? { kind: 'cutin', cardId: NON_HIGH_CUTIN.id }
        : { kind: 'disguise', cardId: NON_HIGH_DISGUISE.id },
    })).toEqual({ ok: true });
    if (route === 'cutin') {
      expect(read.char.ap(current(), 'contact-actor'), 'B06109 non-high-school Cut-In exemption').toBe(4000);
    } else {
      expect(current().players.self.scene.some(character => character.cardId === NON_HIGH_DISGUISE.id), 'B06109 non-high-school Disguise exemption')
        .toBe(true);
    }
  });

  it.each([B06109, B06109P])('$id permits a non-high-school Hirameki', card => {
    const state = b06109State(card, 'self');
    state.turn.player = 'opp';
    state.players.self.evidence = [evidence(NON_HIGH_HIRAMEKI.id)];
    state.players.self.deck = [DRAW.id, EV_A.id];
    state.players.opp.scene = [sceneChar(ACTION_ACTOR.id, 'action-actor')];
    state.players.opp.deck = [EV_B.id, EV_C.id];
    install(state, 'self', `${card.id}-hirameki-exemption`);

    expect(dispatchEngineAction({
      type: 'actionDeclareCase', byUid: 'action-actor', targetPlayer: 'self',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
      player: 'self', cardId: NON_HIGH_HIRAMEKI.id,
    });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    expect(current().players.self.hand, 'B06109/B06109P non-high-school Hirameki exemption').toEqual([DRAW.id]);
  });
});

describe('official QA Wave163: B06109/P has both green and white incident colors', () => {
  it.each([B06109, B06109P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))('$card.id owner=$owner enables D06003 green-and-white text', ({ card, owner }) => {
    const state = b06109State(card, owner);
    state.players[owner].scene = [sceneChar(D06003.id, 'heiji', { isNamed: true })];
    install(state, owner, `${card.id}-${owner}-green-white`);

    expect(read.char.hasKeyword(current(), 'heiji', '突撃'), 'B06109/B06109P green-and-white identity')
      .toBe(true);
  });
});
