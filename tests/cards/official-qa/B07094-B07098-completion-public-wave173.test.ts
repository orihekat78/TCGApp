// qa: card:B07094:46562cdd4a832c2c219c087a402e6bbdbbc11d0a33031b3b0cd7a267c29e0af3
// qa: card:B07096:24dc94f9321e58a7a325489b45930c6c2891ba1c6152c0f967e75d1b558c48de
// qa: card:B07096:3745e22b286a1d465bf847304fc2f2349cbc73c10ce63a474e31211898f1f38e
// qa: card:B07096:dd07064e964a69c483b2bb778b3066b6fd42f825c76964da4f9bdc2769cf088c
// qa: card:B07098:38c2a9a4f5b4ef1212709f13990154e55f266eec17474d1fc7ea8ce443897328
// qa: card:B07098:467ddc2c14383cab200e4caf09cec91d8b75be7a5fa42b3679f5f14a0ee60237
// qa: card:B07098:a5ea07e469f0ddd58b2a36cfca962fa8503d399096515110cf273504a70b9318
// qa: card:B07098:d5ac6e41ffd98ccb21e7f6aed6607437938d8988bf71eab20da1d11d367dbcd4

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05107 } from '@/cards/ct-p05/B05107';
import { B07077 } from '@/cards/ct-p07/B07077';
import { B07094 } from '@/cards/ct-p07/B07094';
import { B07094P } from '@/cards/ct-p07/B07094P';
import { B07096 } from '@/cards/ct-p07/B07096';
import { B07098 } from '@/cards/ct-p07/B07098';
import { B07098P } from '@/cards/ct-p07/B07098P';
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
    id, no: `test/${id}`, kind, names: [id], colors: ['黒'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const BLACK_PARTNER = fixture('W173_BLACK_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1, colors: ['黒'],
});
const HAND_COST = fixture('W173_HAND_COST', { kind: 'event' });
const DRAW = fixture('W173_DRAW', { kind: 'event' });
const FILLER = fixture('W173_FILLER', { ap: 2000 });
const FBI = fixture('W173_FBI', { traits: ['FBI'] });
const LEVEL5_TARGET = fixture('W173_LEVEL5_TARGET', { level: 5, ap: 1000 });
const LEVEL4_TARGET = fixture('W173_LEVEL4_TARGET', { level: 4, ap: 1000 });
const INCOMING = fixture('W173_INCOMING', { level: 3, ap: 2000 });
const MILL_A = fixture('W173_MILL_A', { kind: 'event' });
const MILL_B = fixture('W173_MILL_B', { kind: 'event' });
const TAIL = fixture('W173_TAIL', { kind: 'event' });
const PLAIN_REMOVE = fixture('W173_PLAIN_REMOVE', { kind: 'event' });
const OPP_ENTRY_PROBE = fixture('W173_OPP_ENTRY_PROBE', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'action:declare' },
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { kind: 'character' } },
    },
    description: '相手がアクションしたとき、自分のリムーブからキャラを1枚まで登場させる。',
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
  }],
});
const FIXTURES = [
  BLACK_PARTNER, HAND_COST, DRAW, FILLER, FBI, LEVEL5_TARGET, LEVEL4_TARGET,
  INCOMING, MILL_A, MILL_B, TAIL, PLAIN_REMOVE, OPP_ENTRY_PROBE,
];
const B07094_PRINTS = [B07094, B07094P] as const;
const B07098_PRINTS = [B07098, B07098P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave173 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave173-${label}`);
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

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run })))
    .toEqual({ ok: true });
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: DRAW.id }));
}

function evidence(cardId: string) {
  return { cardId, faceUp: false, origin: { turn: 1, via: 'effect' as const } };
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

describe('official QA Wave173: B07094/P turn-end effects still resolve during the owner turn', () => {
  it.each(B07094_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner removes B05107 at turn end while its self-turn re-entry remains active',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 173, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner = {
        cardId: BLACK_PARTNER.id, state: 'active', location: 'partner-area',
      };
      state.players[owner].scene = [
        sceneChar(card.id, 'gin'),
        sceneChar(B05107.id, 'vodka', { state: 'active' }),
      ];
      state.players[owner].hand = [HAND_COST.id];
      state.players[owner].deck = Array.from({ length: 10 }, () => DRAW.id);
      state.players[other(owner)].scene = [sceneChar(FILLER.id, 'opp-target')];
      state.players[other(owner)].deck = Array.from({ length: 10 }, () => DRAW.id);
      install(state, owner, `${card.id}-${owner}-turn-end-self-turn`);

      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      resolveOptional(card.id, 'a1', true);
      const discard = pendingPick(card.id, 'a1', 'discard');
      choose(discard, discard.candidates.find(candidate => candidate.cardId === HAND_COST.id)!.uid);
      const ownRemoval = pendingPick(card.id, 'a1', 'sceneRemove');
      expect(ownRemoval.candidates.map(candidate => candidate.uid)).toContain('vodka');
      choose(ownRemoval, 'vodka');
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), null);

      expect(current().turn.player, 'B07094/B07094P turn-end trigger remains in owner turn').toBe(owner);
      const reentry = pendingPick(B05107.id, 'a1', 'sceneEnter');
      const removedVodka = reentry.candidates.find(candidate => candidate.cardId === B05107.id)!;
      choose(reentry, removedVodka.uid);
      expect(current().players[owner].scene.find(character => character.cardId === B05107.id)?.state)
        .toBe('sleep');
    },
  );
});

describe('official QA Wave173: B07096 filtered Assault uses effective target level', () => {
  it.each(['self', 'opp'] as const)('owner=%s may target a printed level5 character reduced to effective level4', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 173, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner = {
      cardId: BLACK_PARTNER.id, state: 'active', location: 'partner-area',
    };
    state.players[owner].case = {
      ...state.players[owner].case, cardId: B07077.id, status: '解決編', declaredUseCount: {},
    };
    state.players[owner].evidence = [evidence(MILL_A.id)];
    state.players[owner].scene = [
      sceneChar(B07096.id, 'vodka', { state: 'active', isNamed: true }),
      sceneChar(FBI.id, 'fbi'),
    ];
    state.players[other(owner)].scene = [sceneChar(LEVEL5_TARGET.id, 'level-five', { state: 'sleep' })];
    install(state, owner, `${owner}-effective-level-assault`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { flipFaceUpEvidence: { indices: [0] } },
    })).toEqual({ ok: true });
    choose(pendingPick(B07077.id, 'a2', 'charModifyLevel'), 'level-five');
    expect(read.char.level(current(), 'level-five')).toBe(4);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'vodka', targetUid: 'level-five' }),
      'B07096 Assault levelMax4 reads effective level').toEqual({ ok: true });
  });
});

describe('official QA Wave173: B07096 draw trigger accepts switch and contact removal', () => {
  it.each(['self', 'opp'] as const)('owner=%s draws when an opponent level4 character leaves through switch', owner => {
    const targetSide = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 173, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07096.id, 'vodka', { state: 'active', isNamed: false })];
    state.players[owner].deck = [DRAW.id, DRAW.id];
    state.players[targetSide].scene = [
      sceneChar(OPP_ENTRY_PROBE.id, 'entry-probe'),
      sceneChar(LEVEL4_TARGET.id, 'switch-target', { state: 'sleep' }),
      ...Array.from({ length: 3 }, (_value, index) => sceneChar(FILLER.id, `filler-${index}`)),
    ];
    state.players[targetSide].remove = [INCOMING.id];
    install(state, targetSide, `${owner}-switch-removal`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'vodka', targetUid: 'switch-target' }))
      .toEqual({ ok: true });
    const entry = pendingPick(OPP_ENTRY_PROBE.id, 'a1', 'sceneEnter');
    const incoming = entry.candidates.find(candidate => candidate.cardId === INCOMING.id)!;
    choose(entry, incoming.uid, 'switch-target');

    expect(current().players[owner].hand, 'B07096 switch removal draws').toEqual([DRAW.id]);
    expect(current().players[targetSide].remove).toContain(LEVEL4_TARGET.id);
    expect(current().players[targetSide].scene.some(character => character.cardId === INCOMING.id)).toBe(true);
  });

  it.each(['self', 'opp'] as const)('owner=%s draws when contact removes an opponent level4 character', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 173, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07096.id, 'vodka', { state: 'active', isNamed: false })];
    state.players[owner].deck = [DRAW.id, DRAW.id];
    state.players[other(owner)].scene = [sceneChar(LEVEL4_TARGET.id, 'contact-target', { state: 'sleep' })];
    install(state, owner, `${owner}-contact-removal`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'vodka', targetUid: 'contact-target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' } }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'pass' } }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });

    expect(current().players[owner].hand, 'B07096 contact removal draws').toEqual([DRAW.id]);
    expect(current().players[other(owner)].remove).toContain(LEVEL4_TARGET.id);
  });
});

function b07098HandState(card: CardDef, owner: Player, deck: string[], remove: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 173, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['黒'];
  state.players[owner].case.status = '事件編';
  state.players[owner].file = fileCards(card.level ?? 0);
  state.players[owner].hand = [card.id];
  state.players[owner].deck = [...deck];
  state.players[owner].remove = [...remove];
  return state;
}

describe('official QA Wave173: B07098/P entry mill checks the entire remove area', () => {
  it.each(B07098_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner draws from a pre-existing Cut-In even when neither milled card has Cut-In',
    ({ card, owner }) => {
      install(
        b07098HandState(card, owner, [MILL_A.id, MILL_B.id, DRAW.id, TAIL.id], [B07096.id]),
        owner,
        `${card.id}-${owner}-existing-cutin`,
      );
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });

      expect(current().players[owner].remove, 'B07098/B07098P condition reads whole remove area')
        .toEqual(expect.arrayContaining([B07096.id, MILL_A.id, MILL_B.id]));
      expect(current().players[owner].hand).toEqual([DRAW.id]);
      expect(current().players[owner].deck).toEqual([TAIL.id]);
    },
  );

  it.each(B07098_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner mills only the sole remaining card, refreshes, and does not mill again',
    ({ card, owner }) => {
      install(
        b07098HandState(card, owner, [MILL_A.id], [PLAIN_REMOVE.id]),
        owner,
        `${card.id}-${owner}-short-deck`,
      );
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });

      expect(current().refreshCount[owner], 'B07098/B07098P short mill refreshes once').toBe(1);
      expect(current().players[owner].remove).toEqual([]);
      expect(current().players[owner].deck).toHaveLength(2);
      expect(current().players[owner].deck).toEqual(expect.arrayContaining([MILL_A.id, PLAIN_REMOVE.id]));
      expect(current().players[owner].hand, 'B07098/B07098P does not draw without Cut-In after refresh')
        .toEqual([]);
    },
  );
});

function b07098DeclaredState(card: CardDef, owner: Player, ownerHasCost: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 173, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.status = '解決編';
  state.players[owner].scene = [sceneChar(card.id, 'chianti', { state: 'active' })];
  state.players[owner].remove = ownerHasCost ? [B07096.id] : [];
  state.players[owner].hand = ownerHasCost ? [B07096.id] : [];
  state.players[other(owner)].hand = [B07096.id];
  return state;
}

describe('official QA Wave173: B07098/P declared cost is owner-only and counts the paid card', () => {
  it.each(B07098_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner counts its just-paid black Cut-In in the remove-area AP total',
    ({ card, owner }) => {
      install(b07098DeclaredState(card, owner, true), owner, `${card.id}-${owner}-paid-count`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'chianti', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });

      expect(current().players[owner].remove.filter(cardId => cardId === B07096.id)).toHaveLength(2);
      expect(read.char.ap(current(), 'chianti'), 'B07098/B07098P paid card is included in count')
        .toBe(4000);
      expect(current().players[other(owner)].hand).toEqual([B07096.id]);
    },
  );

  it.each(B07098_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner rejects an opponent-only black Cut-In atomically',
    ({ card, owner }) => {
      install(b07098DeclaredState(card, owner, false), owner, `${card.id}-${owner}-opponent-only`);
      const before = JSON.stringify(current());
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'chianti', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeFromHand: { indices: [0] } },
      }), 'B07098/B07098P hand cost is owner-only').toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);
    },
  );
});
