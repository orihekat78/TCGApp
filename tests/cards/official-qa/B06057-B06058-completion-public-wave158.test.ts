// qa: card:B06057:6ef75028554fc17862ec6d9114267258f52ac2a1d278a1c7fb0e61edc0d1d265
// qa: card:B06057:9cf96476126c1e8f61997b00d847da85ab81c2d0e6281421a481b755b35ea73e
// qa: card:B06058:6881f15695286303edf5b552916dd1faca5e8acc0930bbfc54bd149171acded3
// qa: card:B06058:b0f3eacc47c4c656dfb430f1965f826fcdbdad6f064df0c1803663d0a16f2761

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06057 } from '@/cards/ct-p06/B06057';
import { B06058 } from '@/cards/ct-p06/B06058';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const ordinaryEventAbility: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: {
    hook: 'effect:declared', selfOnly: true,
    matcher: payload => (payload as { kind?: unknown })?.kind === 'event-use',
  },
  effect: { kind: 'atom', verb: 'mill', args: { player: 'self', n: 1, gate: false } },
  description: 'Mill one as the event effect.', ruleRefs: ['rules/15-abilities-effects.md'],
};
const cutinAbility: AbilityDef = {
  id: 'cutin', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000', ruleRefs: ['rules/09-cutin-disguise.md'],
};
const hiramekiAbility: AbilityDef = {
  id: 'hirameki', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。', ruleRefs: ['rules/10-action-event.md'],
};

const ORDINARY_EVENT = fixture('W158_ORDINARY_EVENT', {
  kind: 'event', traits: ['YAIBA'], abilities: [ordinaryEventAbility],
});
const CUTIN_EVENT = fixture('W158_CUTIN_EVENT', {
  kind: 'event', traits: ['YAIBA'], abilities: [cutinAbility],
});
const HIRAMEKI_EVENT = fixture('W158_HIRAMEKI_EVENT', {
  kind: 'event', traits: ['YAIBA'], abilities: [hiramekiAbility],
});
const TETSU = fixture('W158_TETSU', { names: ['鉄刃'], lp: 0, ap: 3000 });
const OPP_TARGET = fixture('W158_OPP_TARGET', { ap: 5000 });
const ATTACKER = fixture('W158_ATTACKER', { ap: 5000 });
const COST = fixture('W158_COST', { kind: 'event' });
const FILE_CARD = fixture('W158_FILE', { kind: 'event' });
const DRAW_A = fixture('W158_DRAW_A', { kind: 'event' });
const DRAW_B = fixture('W158_DRAW_B', { kind: 'event' });
const EVIDENCE = fixture('W158_EVIDENCE', { kind: 'event' });

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave158 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave158-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function resolveB06058Optional(owner: Player): PendingPick {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ player: owner, source: { cardId: B06058.id, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
  const discard = pendingPick(B06058.id, 'a1', 'discard');
  choose(discard, discard.candidates.find(candidate => candidate.cardId === COST.id)!.uid);
  return pendingPick(B06058.id, 'a1', 'sceneSetState');
}

function observerCount(state: GameState, uid: string): number {
  return read.char.declaredUseCount(state, uid, 'a1', {
    abilityOrigin: 'printed', abilityIndex: 0,
  });
}

function observerState(owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 158, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].scene = [sceneChar(B06057.id, 'observer')];
  state.players[owner].deck = [DRAW_A.id, DRAW_B.id];
  state.players[other(owner)].deck = [DRAW_B.id, DRAW_A.id];
  return state;
}

function reachOwnerContactWindow(owner: Player): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'observer', targetUid: 'opp-target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(flow.action._getContext(current(), actionId)).toMatchObject({
    phase: 'action-1', firstUid: 'observer',
  });
  return actionId;
}

function b06058Base(owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 158, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.status = '解決編';
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = Array.from({ length: B06058.level ?? 0 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  state.players[owner].hand = [B06058.id, COST.id];
  state.players[owner].deck = [DRAW_A.id, DRAW_B.id, DRAW_A.id, DRAW_B.id];
  state.players[other(owner)].deck = [DRAW_B.id, DRAW_A.id, DRAW_B.id];
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  registerAll();
  for (const card of [ORDINARY_EVENT, CUTIN_EVENT, HIRAMEKI_EVENT, TETSU, OPP_TARGET, ATTACKER, COST, FILE_CARD, DRAW_A, DRAW_B, EVIDENCE]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave158: B06057 event-use observer', () => {
  it.each(['self', 'opp'] as const)('owner=%s mandatorily draws after an ordinary white YAIBA event resolves', owner => {
    const state = observerState(owner);
    state.players[owner].hand = [ORDINARY_EVENT.id];
    state.players[owner].file = [{ type: 'card-back', cardId: FILE_CARD.id }];
    state.players[owner].deck = [DRAW_A.id, DRAW_B.id, FILE_CARD.id];
    install(state, owner, `${owner}-ordinary-event`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: ORDINARY_EVENT.id }))
      .toEqual({ ok: true });
    expect(current().players[owner].remove).toEqual(expect.arrayContaining([ORDINARY_EVENT.id, DRAW_A.id]));
    expect(current().players[owner].hand).toEqual([DRAW_B.id]);
    expect(current().players[owner].deck).toEqual([FILE_CARD.id]);
    expect(observerCount(current(), 'observer')).toBe(1);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s does not trigger the observer from a white YAIBA Cut-In', owner => {
    const state = observerState(owner);
    state.players[owner].hand = [CUTIN_EVENT.id];
    state.players[other(owner)].scene = [sceneChar(OPP_TARGET.id, 'opp-target', { state: 'sleep' })];
    install(state, owner, `${owner}-cutin`);

    const actionId = reachOwnerContactWindow(owner);
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner,
      choice: { kind: 'cutin', cardId: CUTIN_EVENT.id },
    })).toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual([]);
    expect(current().players[owner].remove).toContain(CUTIN_EVENT.id);
    expect(current().players[owner].deck).toEqual([DRAW_A.id, DRAW_B.id]);
    expect(observerCount(current(), 'observer')).toBe(0);
  });

  it.each(['self', 'opp'] as const)('owner=%s does not trigger the observer from a white YAIBA Hirameki', owner => {
    const turnPlayer = other(owner);
    const state = observerState(owner);
    state.turn.player = turnPlayer;
    state.players[owner].evidence = [{
      cardId: HIRAMEKI_EVENT.id, faceUp: false, origin: { turn: 1, via: 'reasoning' },
    }];
    state.players[turnPlayer].scene = [sceneChar(ATTACKER.id, 'attacker')];
    install(state, owner, `${owner}-hirameki`);

    expect(dispatchEngineAction({
      type: 'actionDeclareCase', byUid: 'attacker', targetPlayer: owner,
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
      player: owner, cardId: HIRAMEKI_EVENT.id,
    });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });

    expect(current().players[owner].hand).toEqual([DRAW_A.id]);
    expect(current().players[owner].deck).toEqual([DRAW_B.id]);
    expect(observerCount(current(), 'observer')).toBe(0);
  });
});

describe('official QA Wave158: B06058 effective LP and repeat action', () => {
  it.each(['self', 'opp'] as const)('owner=%s offers only Tetsu with effective LP exactly zero', owner => {
    const state = b06058Base(owner);
    state.players[owner].scene = [
      sceneChar(TETSU.id, 'lp-zero', { state: 'sleep' }),
      sceneChar(TETSU.id, 'lp-positive', { state: 'sleep', turnEffects: { lpMod_turn: 1 } }),
      sceneChar(TETSU.id, 'lp-negative', { state: 'sleep', turnEffects: { lpMod_turn: -1 } }),
    ];
    install(state, owner, `${owner}-effective-lp`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06058.id }))
      .toEqual({ ok: true });
    const activation = resolveB06058Optional(owner);
    expect(activation.candidates.map(candidate => candidate.uid)).toEqual(['lp-zero']);
    choose(activation, 'lp-zero');
    expect(current().players[owner].scene.find(character => character.uid === 'lp-zero')?.state).toBe('active');
    expect(current().players[owner].scene.find(character => character.uid === 'lp-positive')?.state).toBe('sleep');
    expect(current().players[owner].scene.find(character => character.uid === 'lp-negative')?.state).toBe('sleep');
  });

  it.each((['self', 'opp'] as const).flatMap(owner => (
    ['reasoning', 'action'] as const
  ).map(route => ({ owner, route }))))(
    'owner=$owner may perform $route again after B06058 reactivates Tetsu',
    ({ owner, route }) => {
      const state = b06058Base(owner);
      state.players[owner].scene = [sceneChar(TETSU.id, 'tetsu')];
      state.players[other(owner)].evidence = [0, 1].map(index => ({
        cardId: EVIDENCE.id, faceUp: false,
        origin: { turn: index + 1, via: 'reasoning' as const },
      }));
      install(state, owner, `${owner}-${route}-repeat`);

      if (route === 'reasoning') {
        expect(dispatchEngineAction({ type: 'reasoning', uid: 'tetsu' })).toEqual({ ok: true });
      } else {
        expect(dispatchEngineAction({
          type: 'actionDeclareCase', byUid: 'tetsu', targetPlayer: other(owner),
        })).toEqual({ ok: true });
        const firstActionId = useGameStateStore.getState().activeActionId!;
        expect(dispatchEngineAction({ type: 'actionGuard', actionId: firstActionId, guarderUid: null })).toEqual({ ok: true });
        expect(dispatchEngineAction({ type: 'actionJudge', actionId: firstActionId })).toEqual({ ok: true });
        for (let step = 0; step < 3 && useGameStateStore.getState().activeActionId === firstActionId; step += 1) {
          expect(dispatchEngineAction({ type: 'actionAdvance', actionId: firstActionId })).toEqual({ ok: true });
        }
        expect(useGameStateStore.getState().activeActionId).toBeNull();
      }
      expect(current().players[owner].scene.find(character => character.uid === 'tetsu')?.state).toBe('sleep');

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06058.id }))
        .toEqual({ ok: true });
      const activation = resolveB06058Optional(owner);
      choose(activation, 'tetsu');
      expect(current().players[owner].scene.find(character => character.uid === 'tetsu')?.state).toBe('active');

      const repeated = route === 'reasoning'
        ? dispatchEngineAction({ type: 'reasoning', uid: 'tetsu' })
        : dispatchEngineAction({
            type: 'actionDeclareCase', byUid: 'tetsu', targetPlayer: other(owner),
          });
      expect(repeated).toEqual({ ok: true });
    },
  );
});
