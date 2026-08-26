// qa: card:B08054:94adce46750f1bdd020b0c468474dff27cf3ae1f8ff38f2afb3ac2efdc60af1c

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02020 } from '@/cards/ct-p02/B02020';
import { B08054 } from '@/cards/ct-p08/B08054';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player, SetCardEntry } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
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

const REMOVE_EVENT = fixture('W180_B08054_REMOVE_EVENT', {
  kind: 'event', ap: undefined, lp: undefined,
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: {
      hook: 'effect:declared', selfOnly: true,
      matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
    },
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', side: 'opp', max: 1, cause: 'effect' },
    },
    description: '相手の現場のキャラを1枚まで選び、リムーブする。',
    ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const TO_HAND_EVENT = fixture('W180_B08054_TO_HAND_EVENT', {
  kind: 'event', ap: undefined, lp: undefined,
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: {
      hook: 'effect:declared', selfOnly: true,
      matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
    },
    effect: {
      kind: 'atom', verb: 'sceneToHand',
      args: {
        player: 'self', uid: '$pick',
        target: { kind: 'pick', query: { area: 'scene', side: 'opp' }, n: { min: 0, max: 1 }, chooser: 'self' },
      },
    },
    description: '相手の現場のキャラを1枚まで選び、手札に移す。',
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
  }],
});
const OWN_REMOVE_EVENT = fixture('W180_B08054_OWN_REMOVE_EVENT', {
  kind: 'event', ap: undefined, lp: undefined,
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: {
      hook: 'effect:declared', selfOnly: true,
      matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
    },
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', side: 'self', max: 1, cause: 'effect' },
    },
    description: '自分の現場のキャラを1枚まで選び、リムーブする。',
    ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const ATTACKER = fixture('W180_B08054_ATTACKER', { ap: 9000 });
const HIDDEN = fixture('W180_B08054_HIDDEN', { kind: 'event', ap: undefined, lp: undefined });
const FACE_UP = fixture('W180_B08054_FACE_UP', { kind: 'event', ap: undefined, lp: undefined });
const FILLER = fixture('W180_B08054_FILLER', { kind: 'event', ap: undefined, lp: undefined });
const FIXTURES = [REMOVE_EVENT, TO_HAND_EVENT, OWN_REMOVE_EVENT, ATTACKER, HIDDEN, FACE_UP, FILLER];

function hidden(instanceId: string): SetCardEntry {
  return { cardId: HIDDEN.id, faceUp: false, instanceId };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing B08054 game state');
  return state;
}

function setCards(): SetCardEntry[] {
  return [
    hidden('set:hidden:first'),
    { cardId: FACE_UP.id, faceUp: true, instanceId: 'set:face-up' },
    hidden('set:hidden:second'),
  ];
}

function resolveEventPick(card: CardDef, player: Player, targetUid: string): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player, cardId: card.id })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ player, source: { cardId: card.id, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: targetUid,
  }))).toEqual({ ok: true });
}

function finishContact(actionId: string): void {
  for (let step = 0; step < 16; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) return;
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player: Player = current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
      expect(dispatchEngineAction({ type: 'actionContact', actionId, player, choice: { kind: 'pass' } }))
        .toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('B08054 contact did not settle');
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave180-b08054-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
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
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave180: B08054 immediate host-leave replacement', () => {
  it('returns every face-down occurrence before opponent-effect leave observers resolve', () => {
    const state = createEmptyGameState();
    state.turn = { number: 180, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.case.colors = ['赤'];
    state.players.opp.case.traits = ['赤魔術'];
    state.players.opp.file = [{ type: 'card-back', cardId: FILLER.id }];
    state.players.opp.hand = [REMOVE_EVENT.id];
    state.players.opp.deck = [FILLER.id, FILLER.id, FILLER.id];
    state.players.opp.scene = [sceneChar(B02020.id, 'observer')];
    state.players.self.scene = [sceneChar(B08054.id, 'host', {
      setCards: setCards(),
    })];
    install(state, 'opp', 'opponent-effect-remove');

    const leaveSnapshots: Array<{ hand: string[]; remove: string[]; destination?: unknown; faceUp?: unknown }> = [];
    const stop = event.on('setcard:leave', (draft, payload) => {
      if ((payload as { hostUid?: unknown }).hostUid === 'host') {
        leaveSnapshots.push({
          hand: [...draft.players.self.hand],
          remove: [...draft.players.self.remove],
          destination: (payload as { destination?: unknown }).destination,
          faceUp: (payload as { faceUp?: unknown }).faceUp,
        });
      }
    });
    try {
      expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: REMOVE_EVENT.id }))
        .toEqual({ ok: true });
      surfacePendingSideChannels();
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(pending).toMatchObject({
        player: 'opp', atomVerb: 'sceneRemove', source: { cardId: REMOVE_EVENT.id, abilityId: 'a1' },
      });
      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'effectPickResolve', pickedUid: 'host',
      }))).toEqual({ ok: true });
    } finally {
      stop();
    }

    expect(current().players.self.hand.filter(cardId => cardId === HIDDEN.id),
      'B08054 preserves both hidden physical occurrences in owner hand').toHaveLength(2);
    expect(current().players.self.remove, 'B08054 normally removes the face-up set card and host')
      .toEqual(expect.arrayContaining([FACE_UP.id, B08054.id]));
    expect(current().players.self.remove, 'B08054 replacement prevents hidden identities entering public remove')
      .not.toContain(HIDDEN.id);
    expect(leaveSnapshots).toHaveLength(3);
    expect(leaveSnapshots.filter(snapshot => snapshot.destination === 'hand')).toHaveLength(2);
    expect(leaveSnapshots.filter(snapshot => snapshot.destination === 'remove')).toHaveLength(1);
    expect(leaveSnapshots.every(snapshot => (
      snapshot.hand.filter(cardId => cardId === HIDDEN.id).length === 2
      && !snapshot.remove.includes(HIDDEN.id)
    )), 'B08054 replacement is synchronous before each setcard:leave observer').toBe(true);
    const observerPick = useGameStateStore.getState().pendingEffectPick;
    expect(observerPick).toMatchObject({
      player: 'opp', atomVerb: 'charSetCard', source: { cardId: B02020.id, abilityId: 'a1' },
    });
    const queuedPayload = (observerPick as unknown as {
      continuation?: { ctx?: { triggerPayload?: Record<string, unknown> } };
    }).continuation?.ctx?.triggerPayload;
    expect(queuedPayload).toMatchObject({
      player: 'self', hostUid: 'host', hostCardId: B08054.id, faceUp: false, destination: 'hand',
    });
    expect(queuedPayload).not.toHaveProperty('setCardId');
    expect(queuedPayload).not.toHaveProperty('setCardInstanceId');
    expect(JSON.stringify(observerPick), 'opponent observer decision hides returned set identities')
      .not.toContain(HIDDEN.id);
    expect(JSON.stringify(projectReplayStateForViewer(current(), 'spectator')),
      'B08054 never exposes returned hidden identities to opponent/spectator projection').not.toContain(HIDDEN.id);
    expect(JSON.stringify(projectReplayStateForViewer(current(), 'solo-self')),
      'owner projection retains the returned hand identities').toContain(HIDDEN.id);

    expect(dispatchEngineAction(bindPendingDecision(observerPick!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.opp.hand).toContain(FILLER.id);
  });

  it('preserves the host destination when an opponent effect returns it to hand', () => {
    const state = createEmptyGameState();
    state.turn = { number: 180, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.case.colors = ['赤'];
    state.players.opp.file = [{ type: 'card-back', cardId: FILLER.id }];
    state.players.opp.hand = [TO_HAND_EVENT.id];
    state.players.opp.deck = [FILLER.id, FILLER.id];
    state.players.self.scene = [sceneChar(B08054.id, 'host', { setCards: setCards() })];
    install(state, 'opp', 'opponent-effect-to-hand');

    resolveEventPick(TO_HAND_EVENT, 'opp', 'host');

    expect(current().players.self.scene).toEqual([]);
    expect(current().players.self.hand).toEqual(expect.arrayContaining([B08054.id, HIDDEN.id, HIDDEN.id]));
    expect(current().players.self.remove).toContain(FACE_UP.id);
    expect(current().players.self.remove).not.toContain(HIDDEN.id);
  });

  it('does not replace ordinary cleanup for the owner effect', () => {
    const state = createEmptyGameState();
    state.turn = { number: 180, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['赤'];
    state.players.self.file = [{ type: 'card-back', cardId: FILLER.id }];
    state.players.self.hand = [OWN_REMOVE_EVENT.id];
    state.players.self.deck = [FILLER.id, FILLER.id];
    state.players.self.scene = [sceneChar(B08054.id, 'host', { setCards: setCards() })];
    install(state, 'self', 'owner-effect-remove');

    resolveEventPick(OWN_REMOVE_EVENT, 'self', 'host');

    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.remove.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
    expect(current().players.self.remove).toEqual(expect.arrayContaining([FACE_UP.id, B08054.id]));
  });

  it('applies the same replacement when contact removes B08054', () => {
    const state = createEmptyGameState();
    state.turn = { number: 180, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [sceneChar(ATTACKER.id, 'attacker')];
    state.players.self.scene = [sceneChar(B08054.id, 'host', { state: 'sleep', setCards: setCards() })];
    install(state, 'opp', 'contact-remove');

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'host' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    finishContact(actionId);

    expect(current().players.self.scene).toEqual([]);
    expect(current().players.self.hand.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
    expect(current().players.self.remove).toEqual(expect.arrayContaining([FACE_UP.id, B08054.id]));
    expect(current().players.self.remove).not.toContain(HIDDEN.id);
  });
});
