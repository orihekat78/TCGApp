// qa: card:B03112:2c83e05699547a122e72d36589adce2d81152f65597bff1f1551047f02568ed9
// qa: card:B03112:671a506d6cd45b85ab6e121432c77d00d150acccde74ac53b33970e89b80f54f
// qa: card:B03112:6d00eabe29a7a4e6bbdca2e810c993d56415fc94c3310a33400a53ebd1b54db6
// qa: card:B03112:b1a3c7472a2248be278d144ae47014dab080904c11c3b6229b08fcb231d415ca

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03112 } from '@/cards/ct-p03/B03112';
import { B03112P } from '@/cards/ct-p03/B03112P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
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

function cutIn(id: string, ability: AbilityDef): CardDef {
  return fixture(id, { abilities: [ability] });
}

const INEFFECTIVE_CUT = cutIn('W151_INEFFECTIVE_CUT', {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 4000, scope: 'contact' } },
  description: '【相手ターン中】【カットイン】AP＋4000', ruleRefs: [],
});
const VALID_CUT = cutIn('W151_VALID_CUT', {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000', ruleRefs: [],
});
const OPP_REMOVE_CUT = cutIn('W151_OPP_REMOVE_CUT', {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: {
    kind: 'atom', verb: 'sceneRemove',
    args: { player: 'self', side: 'opp', max: 1, filter: { cardName: 'Black Victim' }, cause: 'effect' },
  },
  description: 'Remove one opposing Black Victim.', ruleRefs: [],
});
const SELF_REMOVER = fixture('W151_SELF_REMOVER', {
  colors: ['黄'],
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', side: 'self', max: 1, filter: { cardName: 'Black Victim' }, cause: 'effect' },
    },
    description: 'Remove one own Black Victim.', ruleRefs: [],
  }],
});
const BLACK_VICTIM = fixture('W151_BLACK_VICTIM', { names: ['Black Victim'] });
const TARGET = fixture('W151_TARGET', { colors: ['青'], ap: 1000 });
const INCOMING = fixture('W151_INCOMING');
const FILLERS = [
  fixture('W151_FILLER_A', { colors: ['黄'] }),
  fixture('W151_FILLER_B', { colors: ['黄'] }),
  fixture('W151_FILLER_C', { colors: ['黄'] }),
] as const;
const FILE_CARD = fixture('W151_FILE_CARD', { kind: 'event' });

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave151 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(`qa-wave151-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function contactState(source: CardDef, owner: Player, cutInCard: CardDef, handOwner: Player = owner): GameState {
  const defender = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 51, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(source.id, 'source')];
  state.players[defender].scene = [sceneChar(TARGET.id, 'target', { state: 'sleep' })];
  state.players[handOwner].hand = [cutInCard.id];
  return state;
}

function startContact(owner: Player): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(current().actionContexts?.[actionId]).toMatchObject({
    phase: 'action-1', firstUid: 'target', secondUid: 'source',
  });
  return actionId;
}

function useOwnerCutIn(actionId: string, owner: Player, cardId: string): void {
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' },
  })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId },
  })).toEqual({ ok: true });
}

function finishContact(actionId: string, owner: Player): void {
  const defender = other(owner);
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: defender, choice: { kind: 'pass' },
  })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
}

function resolveRemoval(cardId: string, uid = 'victim'): void {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: 'sceneRemove', source: { cardId } });
  expect(pick?.candidates.map(candidate => candidate.uid)).toEqual([uid]);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  for (const card of [
    INEFFECTIVE_CUT, VALID_CUT, OPP_REMOVE_CUT, SELF_REMOVER,
    BLACK_VICTIM, TARGET, INCOMING, ...FILLERS, FILE_CARD,
  ]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave151: B03112 Cut-In observer', () => {
  it('adds only Rai AP when the used Cut-In text is ineffective', () => {
    install(contactState(B03112, 'self', INEFFECTIVE_CUT), 'self', 'ineffective-cutin');
    const actionId = startContact('self');
    useOwnerCutIn(actionId, 'self', INEFFECTIVE_CUT.id);

    expect(readChar.ap(current(), 'source')).toBe(7000);
    finishContact(actionId, 'self');
    expect(readChar.ap(current(), 'source')).toBe(5000);
  });

  it('adds the Cut-In AP and Rai AP independently, then expires both', () => {
    install(contactState(B03112P, 'opp', VALID_CUT), 'opp', 'additive-cutin');
    const actionId = startContact('opp');
    useOwnerCutIn(actionId, 'opp', VALID_CUT.id);

    expect(readChar.ap(current(), 'source')).toBe(8000);
    finishContact(actionId, 'opp');
    expect(readChar.ap(current(), 'source')).toBe(5000);
  });
});

describe('official QA Wave151: B03112 effect-owner attribution', () => {
  it('gains LP when its owner effect removes an own black character', () => {
    const state = createEmptyGameState();
    state.turn = { number: 51, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B03112.id, 'source'),
      sceneChar(SELF_REMOVER.id, 'remover'),
      sceneChar(BLACK_VICTIM.id, 'victim'),
    ];
    install(state, 'self', 'own-effect');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
      .toEqual({ ok: true });
    resolveRemoval(SELF_REMOVER.id);
    expect(current().players.self.remove).toContain(BLACK_VICTIM.id);
    expect(readChar.lp(current(), 'source')).toBe(2);
  });

  it('does not gain LP when an opponent Cut-In effect removes that character', () => {
    const owner = 'opp' as const;
    const defender = other(owner);
    const state = contactState(B03112P, owner, OPP_REMOVE_CUT, defender);
    state.players[owner].scene.push(sceneChar(BLACK_VICTIM.id, 'victim'));
    install(state, defender, 'opponent-effect');

    const actionId = startContact(owner);
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: defender,
      choice: { kind: 'cutin', cardId: OPP_REMOVE_CUT.id },
    })).toEqual({ ok: true });
    resolveRemoval(OPP_REMOVE_CUT.id);
    expect(current().players[owner].remove).toContain(BLACK_VICTIM.id);
    expect(readChar.lp(current(), 'source')).toBe(1);
  });
});

describe('official QA Wave151: B03112 switch exclusion', () => {
  it('does not gain LP when an own black character is removed for a public switch', () => {
    const owner = 'opp' as const;
    const state = createEmptyGameState();
    state.turn = { number: 51, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黒'];
    state.players[owner].file = [{ type: 'card-back', cardId: FILE_CARD.id }];
    state.players[owner].hand = [INCOMING.id];
    state.players[owner].scene = [
      sceneChar(B03112P.id, 'source'),
      sceneChar(BLACK_VICTIM.id, 'victim'),
      ...FILLERS.map((card, index) => sceneChar(card.id, `filler-${index}`)),
    ];
    install(state, owner, 'switch');

    expect(dispatchEngineAction({
      type: 'handUseCardSwitch', player: owner, cardId: INCOMING.id, removeUid: 'victim',
    })).toEqual({ ok: true });
    expect(current().players[owner].remove).toContain(BLACK_VICTIM.id);
    expect(current().players[owner].scene.some(character => character.cardId === INCOMING.id)).toBe(true);
    expect(readChar.lp(current(), 'source')).toBe(1);
  });
});
