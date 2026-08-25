// qa: card:B06068:1a2a46c6c6f2d223c19bf80a2832fa8cc71d77c57cb5d6b98be4e42610903db0
// qa: card:B06068:2e5a940a45132f39f38d229848ff63c9f93f8e007a2c106e8756aba758e1baf8
// qa: card:B06068:749063705a6e637ab3c472a772e6085afb25598e7ebdb06f006066f92a539a03
// qa: card:B06068:a93b9aaf8ad6a16ee8cbd1f123e13b804da2fdb54acd945b41e50cb358ed2a5d
// qa: card:B06068:b7b643c73534f6703e333cfa990daa269bcaccd0c23a48c4c1881b0a59f77c63

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { registerAll } from '@/cards';
import { B06068 } from '@/cards/ct-p06/B06068';
import { B06068P } from '@/cards/ct-p06/B06068P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const SONOKO = fixture('W139_SONOKO', { names: ['鈴木園子'] });
const VICTIM = fixture('W139_VICTIM', { ap: 1000 });
const HAND = fixture('W139_HAND');
const TAIL = fixture('W139_TAIL');
const PRINTINGS = [B06068, B06068P] as const;
const PRINTING_OWNERS = PRINTINGS.flatMap(printing =>
  (['self', 'opp'] as const).map(owner => ({ printing, owner })));

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave139 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave139 action ${actionId}`);
  return action;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave139-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(
  printing: CardDef,
  owner: Player,
  options: { named?: boolean; granted?: string[] } = {},
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 33, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(printing.id, 'kyo', {
      isNamed: options.named ?? true,
      keywordOverrides: { granted: options.granted ?? [], disabledOriginal: false },
    }),
    sceneChar(SONOKO.id, 'sonoko'),
  ];
  state.players[owner].hand = [HAND.id];
  state.players[owner].deck = [TAIL.id, TAIL.id];
  state.players[other(owner)].scene = [
    sceneChar(VICTIM.id, 'victim-1', { state: 'sleep' }),
    sceneChar(VICTIM.id, 'victim-2', { state: 'sleep' }),
  ];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id];
  return state;
}

function removeThroughContact(owner: Player, targetUid: string): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'kyo', targetUid,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
    .toEqual({ ok: true });
  for (let step = 0; step < 20; step += 1) {
    const action = actionContext(actionId);
    if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      break;
    }
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players[owner].scene.some(character => character.uid === actingUid)
        ? owner
        : other(owner);
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  return actionId;
}

function pendingOptional(printing: CardDef, owner: Player) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({
    player: owner,
    source: { uid: 'kyo', cardId: printing.id, abilityId: 'a1' },
  });
  return pending!;
}

function resolveRun(printing: CardDef, owner: Player): void {
  const optional = pendingOptional(printing, owner);
  expect(dispatchEngineAction(bindPendingDecision(optional, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
  surfacePendingSideChannels();
  const discard = useGameStateStore.getState().pendingEffectPick;
  expect(discard).toMatchObject({ player: owner, atomVerb: 'discard', nMin: 1, nMax: 1 });
  expect(discard?.candidates.map(candidate => candidate.cardId)).toEqual([HAND.id]);
  expect(dispatchEngineAction(bindPendingDecision(discard!, {
    type: 'effectPickResolve', pickedUid: discard!.candidates[0]!.uid,
  }))).toEqual({ ok: true });
}

function resolveDecline(printing: CardDef, owner: Player): void {
  const optional = pendingOptional(printing, owner);
  expect(dispatchEngineAction(bindPendingDecision(optional, {
    type: 'optionalResolve', run: false,
  }))).toEqual({ ok: true });
}

function settleAction(actionId: string): void {
  for (let step = 0; step < 6 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function hasAiCharAction(owner: Player, targetUid = 'victim-2'): boolean {
  return enumerateMoves(current(), owner).some(move =>
    move.kind === 'actionAgainstChar' && move.byUid === 'kyo' && move.targetUid === targetUid);
}

function grantAfterResolution(keyword: string): void {
  useGameStateStore.setState({
    gameState: produce(current(), draft => mutate.char.grantKeyword(draft, 'kyo', keyword, 'turn')),
  });
}

function reactivate(): void {
  useGameStateStore.setState({
    gameState: produce(current(), draft => mutate.scene.setState(draft, 'kyo', 'active')),
  });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [SONOKO, VICTIM, HAND, TAIL]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave139: action permission follows named state and exact keyword', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner may action a character when not named', ({ printing, owner }) => {
    install(base(printing, owner, { named: false }), owner, `${printing.id}-${owner}-not-named`);
    const actionId = removeThroughContact(owner, 'victim-1');
    resolveRun(printing, owner);
    settleAction(actionId);

    expect(readChar.hasKeyword(current(), 'kyo', '突撃[キャラ]')).toBe(false);
    expect(hasAiCharAction(owner)).toBe(true);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'kyo', targetUid: 'victim-2' }))
      .toEqual({ ok: true });
  });

  it.each(['self', 'opp'] as const)('owner %s keeps generic Assault granted before resolution', owner => {
    install(base(B06068, owner, { granted: ['突撃'] }), owner, `${owner}-generic-assault`);
    const actionId = removeThroughContact(owner, 'victim-1');
    resolveRun(B06068, owner);
    settleAction(actionId);

    expect(readChar.hasKeyword(current(), 'kyo', '突撃')).toBe(true);
    expect(readChar.hasKeyword(current(), 'kyo', '突撃[キャラ]')).toBe(false);
    expect(hasAiCharAction(owner)).toBe(true);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'kyo', targetUid: 'victim-2' }))
      .toEqual({ ok: true });
  });

  it.each(PRINTING_OWNERS)('$printing.id owner $owner loses every pre-resolution Assault[character]', ({ printing, owner }) => {
    install(base(printing, owner, { granted: ['突撃[キャラ]'] }), owner, `${printing.id}-${owner}-pre-granted`);
    const actionId = removeThroughContact(owner, 'victim-1');
    resolveRun(printing, owner);
    settleAction(actionId);

    expect(readChar.hasKeyword(current(), 'kyo', '突撃[キャラ]')).toBe(false);
    expect(hasAiCharAction(owner)).toBe(false);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'kyo', targetUid: 'victim-2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
  });
});

describe('official QA Wave139: post-resolution grants restore character action', () => {
  it.each((['self', 'opp'] as const).flatMap(owner =>
    (['突撃', '突撃[キャラ]'] as const).map(keyword => ({ owner, keyword }))))(
    'owner $owner later $keyword', ({ owner, keyword }) => {
      const keywordLabel = keyword === '突撃' ? 'assault' : 'assault-char';
      install(base(B06068, owner), owner, `${owner}-${keywordLabel}-post-grant`);
      const actionId = removeThroughContact(owner, 'victim-1');
      resolveRun(B06068, owner);
      settleAction(actionId);
      grantAfterResolution(keyword);

      expect(readChar.hasKeyword(current(), 'kyo', keyword)).toBe(true);
      expect(hasAiCharAction(owner)).toBe(true);
      expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'kyo', targetUid: 'victim-2' }))
        .toEqual({ ok: true });
    },
  );
});

describe('official QA Wave139: decline still spends Turn 1', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    install(base(printing, owner), owner, `${printing.id}-${owner}-decline`);
    const firstActionId = removeThroughContact(owner, 'victim-1');
    resolveDecline(printing, owner);
    settleAction(firstActionId);
    reactivate();

    const secondActionId = removeThroughContact(owner, 'victim-2');
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    settleAction(secondActionId);
  });
});
