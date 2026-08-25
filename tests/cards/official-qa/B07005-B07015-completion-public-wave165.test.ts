// qa: card:B07005:c596ae62d295a0df22c230a2cbc61a4567f85c825a50fd331245bee0fa8fa94c
// qa: card:B07008:cb48ad5742f63c2a3b6c5b048905bade78ab9cec63501a1ce37450092eb0d7af
// qa: card:B07008:241b02bbb7a8197710e7c0ed17093c02e009cea693fa3391d4e1fa3577457fe1
// qa: card:B07009:684d62441f6ae3dcf940ea71c84bb30e59e92ef6cbe04ac02ddbeacb5aec06d6
// qa: card:B07010:3c5311bf5b7b3ddb55695107de7b3e7ac562b49df49486020cbf2f14f49f4137
// qa: card:B07011:1c10b9e97107208c6fd31174fe5b3b8f52f89fc789fee528f6ffc2b2a8aef5c7
// qa: card:B07012:13f7236b17a7c3f7577c4e42cab42556ddb14ba5f6edf1dfaf0192479bb325ed
// qa: card:B07015:6717248f8a1ed1d34006e53d306840354235151597ab416af3b9a421f8603070
// qa: card:B07015:2f7dc2557c5ec988da3b2e72a18d5c685ca1a99b820578d15180b3a4021a1072

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards';
import { B07005 } from '@/cards/ct-p07/B07005';
import { B07008 } from '@/cards/ct-p07/B07008';
import { B07009 } from '@/cards/ct-p07/B07009';
import { B07009P } from '@/cards/ct-p07/B07009P';
import { B07010 } from '@/cards/ct-p07/B07010';
import { B07011 } from '@/cards/ct-p07/B07011';
import { B07012 } from '@/cards/ct-p07/B07012';
import { B07012P } from '@/cards/ct-p07/B07012P';
import { B07015 } from '@/cards/ct-p07/B07015';
import { B07015P } from '@/cards/ct-p07/B07015P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const BLUE_PARTNER = fixture('W165_BLUE_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const GREEN_PARTNER = fixture('W165_GREEN_PARTNER', {
  kind: 'partner', colors: ['緑'], level: undefined, ap: undefined, lp: 1,
});
const ERI = fixture('W165_ERI', { names: ['妃英理'] });
const CONTACT_TARGET = fixture('W165_CONTACT_TARGET', { ap: 2000 });
const CUTIN: CardDef = fixture('W165_CUTIN', {
  abilities: [{
    id: 'cutin', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    description: 'Wave165 Cut-In.', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const DISGUISE = fixture('W165_DISGUISE', {
  abilities: [{
    id: 'disguise', type: 'icon-disguise',
    description: 'Wave165 Disguise.', ruleRefs: ['rules/09-cutin-disguise.md'],
  } as AbilityDef],
});
const FILE_CARD = fixture('W165_FILE_CARD', { kind: 'event' });
const QUALIFIER = fixture('W165_QUALIFIER', { traits: ['少年探偵団'] });
const ACTOR = fixture('W165_ACTOR', { ap: 3000 });
const DRAW = fixture('W165_DRAW', { kind: 'event' });
const BOY_MATCH = fixture('W165_BOY_MATCH', { traits: ['少年探偵団'] });
const TAIL = fixture('W165_TAIL', { kind: 'event' });
const REFRESH_CARD = fixture('W165_REFRESH_CARD', { kind: 'event' });
const NON_BLUE = fixture('W165_NON_BLUE', { colors: ['赤'] });
const BLUE_FILLER = fixture('W165_BLUE_FILLER');
const LEVEL4_TARGET = fixture('W165_LEVEL4_TARGET', { level: 4 });
const GREEN_EVENT = fixture('W165_GREEN_EVENT', { kind: 'event', colors: ['緑'], level: 5 });
const HATTORI_OPTIONAL: AbilityDef = {
  id: 'enter-optional', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
  description: 'Wave165 Hattori entry sentinel.', ruleRefs: ['rules/15-abilities-effects.md'],
};
const HATTORI = fixture('W165_HATTORI', {
  names: ['服部平次'], colors: ['緑'], abilities: [HATTORI_OPTIONAL],
});
const HATTORI_PLAIN = fixture('W165_HATTORI_PLAIN', {
  names: ['服部平次'], colors: ['緑'],
});
const FIXTURES = [
  BLUE_PARTNER, GREEN_PARTNER, ERI, CONTACT_TARGET, CUTIN, DISGUISE, FILE_CARD,
  QUALIFIER, ACTOR, DRAW, BOY_MATCH, TAIL, REFRESH_CARD, NON_BLUE, BLUE_FILLER,
  LEVEL4_TARGET, GREEN_EVENT, HATTORI, HATTORI_PLAIN,
];
const B07009_PRINTS = [B07009, B07009P] as const;
const B07012_PRINTS = [B07012, B07012P] as const;
const B07015_PRINTS = [B07015, B07015P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave165 state');
  return state;
}

function cardBacks(count: number, topCardId?: string) {
  const cards = Array.from({ length: count }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id, faceUp: true,
  }));
  if (topCardId && cards.length > 0) cards[cards.length - 1] = {
    type: 'card-back', cardId: topCardId, faceUp: true,
  };
  return cards;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave165-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

function reachContactWindow(owner: Player, actorUid = 'contact-actor'): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: actorUid, targetUid: 'contact-target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave165 contact ended before owner action window');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
      if (player === owner && uid === actorUid) return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave165 owner contact window not reached');
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
  vi.restoreAllMocks();
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave165: B07005 contact restriction', () => {
  it.each(['self', 'opp'] as const)('owner=%s blocks Cut-In but permits Disguise', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07005.id, 'contact-actor'), sceneChar(ERI.id, 'eri')];
    state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'contact-target', { state: 'sleep' })];
    state.players[owner].hand = [CUTIN.id, DISGUISE.id];
    install(state, owner, `${owner}-B07005-contact`);

    const actionId = reachContactWindow(owner);
    const cutinResult = dispatchEngineAction({
      type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId: CUTIN.id },
    });
    expect(cutinResult, 'B07005 bans only Cut-In').toEqual({ ok: false, reason: 'not-allowed' });
    const disguiseResult = dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'disguise', cardId: DISGUISE.id } });
    expect(disguiseResult, 'B07005 permits Disguise').toEqual({ ok: true });
    expect(current().players[owner].hand).toContain(CUTIN.id);
    expect(current().players[owner].scene.some(character => character.cardId === DISGUISE.id)).toBe(true);
  });
});

describe('official QA Wave165: B07008 hand level and Next Hint FILE timing', () => {
  it.each(['self', 'opp'] as const)('owner=%s restores printed level on scene', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner.cardId = BLUE_PARTNER.id;
    state.players[owner].case = { ...state.players[owner].case, status: '解決編', colors: ['青'] };
    state.players[owner].file = cardBacks(7);
    state.players[owner].scene = [sceneChar(QUALIFIER.id, 'qualifier')];
    state.players[owner].hand = [B07008.id];
    install(state, owner, `${owner}-B07008-hand-level`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07008.id }))
      .toEqual({ ok: true });
    const entered = current().players[owner].scene.find(character => character.cardId === B07008.id)!;
    expect(read.char.level(current(), entered.uid), 'B07008 hand-only reduction resets on scene')
      .toBe(8);
  });

  it.each(['self', 'opp'] as const)('owner=%s Next Hint FILE5 becomes FILE4 before enter condition', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner.cardId = BLUE_PARTNER.id;
    state.players[owner].case = { ...state.players[owner].case, status: '解決編', colors: ['青'] };
    state.players[owner].file = cardBacks(5, B07008.id);
    state.players[owner].scene = Array.from({ length: 4 }, (_, index) => (
      sceneChar(QUALIFIER.id, `qualifier-${index}`)
    ));
    install(state, owner, `${owner}-B07008-next-hint`);

    expect(dispatchEngineAction({ type: 'nextHint', player: owner, optionalCardId: B07008.id }))
      .toEqual({ ok: true });

    expect(current().players[owner].file, 'B07008 Next Hint consumes FILE5 top card').toHaveLength(4);
    expect(current().players[owner].scene.some(character => character.cardId === B07008.id)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectOptional, 'B07008 FILE5 enter ability is inactive at FILE4')
      .toBeNull();
  });
});

describe('official QA Wave165: B07009/P nonqualifying Cut-In', () => {
  it.each(B07009_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner still gives AP but does not draw',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(ACTOR.id, 'contact-actor')];
      state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'contact-target', { state: 'sleep' })];
      state.players[owner].hand = [card.id];
      state.players[owner].deck = [DRAW.id];
      install(state, owner, `${card.id}-${owner}-nonqualifying`);

      const actionId = reachContactWindow(owner);
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId: card.id },
      })).toEqual({ ok: true });

      expect(read.char.ap(current(), 'contact-actor'), 'B07009/B07009P unconditional AP branch')
        .toBe(4000);
      expect(current().players[owner].deck, 'B07009/B07009P nonqualifying branch draws nothing')
        .toEqual([DRAW.id]);
      expect(current().players[owner].remove).toContain(card.id);
    },
  );
});

describe('official QA Wave165: B07010 short deck timing', () => {
  it.each(['self', 'opp'] as const)('owner=%s refreshes only after the looked-at remainder moves', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner.cardId = BLUE_PARTNER.id;
    state.players[owner].case.colors = ['青'];
    state.players[owner].case.status = '事件編';
    state.players[owner].file = cardBacks(4);
    state.players[owner].hand = [B07010.id];
    state.players[owner].deck = [BOY_MATCH.id, TAIL.id];
    state.players[owner].remove = [REFRESH_CARD.id];
    install(state, owner, `${owner}-B07010-short-deck`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07010.id }))
      .toEqual({ ok: true });
    const reveal = pendingPick(B07010.id, 'a1', 'deckRevealUntil');
    choose(reveal, reveal.candidates.find(candidate => candidate.cardId === BOY_MATCH.id)!.uid);

    expect(current().refreshCount[owner], 'B07010 refresh checkpoint').toBe(1);
    expect(current().players[owner].hand).toEqual([BOY_MATCH.id]);
    expect([...current().players[owner].deck].sort(), 'B07010 remainder joins refresh pool')
      .toEqual([REFRESH_CARD.id, TAIL.id].sort());
    expect(current().players[owner].remove).toEqual([]);
  });
});

describe('official QA Wave165: B07011 tied RPS repeats', () => {
  it.each(['self', 'opp'] as const)('owner=%s receives a fresh RPS decision after a tie', owner => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = createEmptyGameState();
    state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner.cardId = BLUE_PARTNER.id;
    state.players[owner].case.colors = ['青'];
    state.players[owner].case.status = '事件編';
    state.players[owner].file = cardBacks(3);
    state.players[owner].hand = [B07011.id];
    state.players[owner].deck = [DRAW.id];
    install(state, owner, `${owner}-B07011-rps-tie`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07011.id }))
      .toEqual({ ok: true });
    const first = useGameStateStore.getState().pendingRps!;
    expect(first).toMatchObject({ player: owner, ownerPlayer: owner, aiHand: 'rock' });
    expect(dispatchEngineAction(bindPendingDecision(first, { type: 'rpsResolve', hand: 'rock' })))
      .toEqual({ ok: true });

    const retry = useGameStateStore.getState().pendingRps!;
    expect(retry.decisionId, 'B07011 tie creates a new decision').not.toBe(first.decisionId);
    expect(retry.aiHand).toBe('rock');
    expect(dispatchEngineAction(bindPendingDecision(retry, { type: 'rpsResolve', hand: 'paper' })))
      .toEqual({ ok: true });
    expect(current().players[owner].hand, 'B07011 resolves only after a winner exists')
      .toEqual([DRAW.id]);
    expect(useGameStateStore.getState().pendingRps).toBeNull();
  });
});

describe('official QA Wave165: B07012/P switch snapshot', () => {
  it.each(B07012_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner sees no nonblue character after simultaneous switch',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner.cardId = BLUE_PARTNER.id;
      state.players[owner].case = { ...state.players[owner].case, status: '解決編', colors: ['青'] };
      state.players[owner].file = cardBacks(6);
      state.players[owner].scene = [sceneChar(NON_BLUE.id, 'switch-out')];
      for (let index = 0; index < 4; index += 1) {
        state.players[owner].scene.push(sceneChar(BLUE_FILLER.id, `blue-${index}`));
      }
      state.players[owner].hand = [card.id];
      state.players[opponent].scene = [sceneChar(LEVEL4_TARGET.id, 'level4-target')];
      install(state, owner, `${card.id}-${owner}-switch-snapshot`);

      expect(dispatchEngineAction({
        type: 'handUseCardSwitch', player: owner, cardId: card.id, removeUid: 'switch-out',
      })).toEqual({ ok: true });

      expect(current().players[owner].remove, 'B07012/B07012P simultaneous switch removes last nonblue')
        .toContain(NON_BLUE.id);
      expect(current().players[owner].scene.some(character => character.cardId === card.id)).toBe(true);
      expect(current().players[opponent].scene.some(character => character.uid === 'level4-target'), 'B07012/B07012P condition sees post-switch scene')
        .toBe(true);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    },
  );
});

function b07015State(card: CardDef, owner: Player, entrant: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 165, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner.cardId = GREEN_PARTNER.id;
  state.players[owner].case.colors = ['緑'];
  state.players[owner].file = cardBacks(1);
  state.players[owner].partnerAreaMR = sceneChar(card.id, `partnerMR:${owner}`, { isNamed: false });
  state.players[owner].hand = [entrant.id];
  return state;
}

describe('official QA Wave165: B07015/P owner order and short-deck timing', () => {
  it.each(B07015_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).flatMap(owner => (
    ['source', 'entrant'] as const
  ).map(first => ({ card, owner, first })))))('$card.id owner=$owner resolves $first first', ({ card, owner, first }) => {
    const state = b07015State(card, owner, HATTORI);
    state.players[owner].deck = [GREEN_EVENT.id, TAIL.id, TAIL.id, TAIL.id, TAIL.id];
    install(state, owner, `${card.id}-${owner}-${first}-first`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: HATTORI.id }))
      .toEqual({ ok: true });
    const group = pendingOwnerOrderGroup(current(), owner).filter(entry => (
      entry.source.cardId === card.id || entry.source.cardId === HATTORI.id
    ));
    expect(group.map(entry => entry.source.cardId).sort(), 'B07015/B07015P simultaneous owner choices')
      .toEqual([HATTORI.id, card.id].sort());
    const firstCardId = first === 'source' ? card.id : HATTORI.id;
    const firstEntry = group.find(entry => entry.source.cardId === firstCardId)!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: firstEntry.id, order: 0, player: owner }))
      .toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(current(), owner).filter(entry => (
      group.some(candidate => candidate.id === entry.id)
    ));
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id),
    })).toEqual({ ok: true });
    surfacePendingSideChannels();

    if (first === 'source') {
      expect(useGameStateStore.getState().pendingEffectPick, 'B07015/B07015P owner may resolve source first')
        .toMatchObject({ atomVerb: 'deckRevealUntil', source: { cardId: card.id, abilityId: 'a2' } });
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    } else {
      expect(useGameStateStore.getState().pendingEffectOptional, 'B07015/B07015P owner may resolve entrant first')
        .toMatchObject({ source: { cardId: HATTORI.id, abilityId: 'enter-optional' } });
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    }
  });

  it.each(B07015_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner refreshes after the looked-at remainder leaves the deck',
    ({ card, owner }) => {
      const state = b07015State(card, owner, HATTORI_PLAIN);
      state.players[owner].deck = [GREEN_EVENT.id, TAIL.id];
      state.players[owner].remove = [REFRESH_CARD.id];
      install(state, owner, `${card.id}-${owner}-short-deck`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: HATTORI_PLAIN.id }))
        .toEqual({ ok: true });
      const reveal = pendingPick(card.id, 'a2', 'deckRevealUntil');
      choose(reveal, reveal.candidates.find(candidate => candidate.cardId === GREEN_EVENT.id)!.uid);

      const discard = pendingPick(card.id, 'a2', 'discard');
      expect(current().refreshCount[owner], 'B07015/B07015P refresh checkpoint').toBe(1);
      expect(current().players[owner].hand).toContain(GREEN_EVENT.id);
      expect([...current().players[owner].deck].sort(), 'B07015/B07015P remainder joins refresh pool')
        .toEqual([REFRESH_CARD.id, TAIL.id].sort());
      choose(discard, discard.candidates[0]!.uid);
    },
  );
});
