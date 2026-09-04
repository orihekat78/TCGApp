// qa: card:B07001:9008e450155fd9d8c51c93ed1ce6e7747a6d956514d5141c12b9e1499dee91e9
// qa: card:B07001:3ba2c681a2b0b87e9836fd9d8ac464dfbef5f7fae479ef7c2910bc6cd18acbcc
// qa: card:B07001:80a2cfb16a87e5d0d4da8698cb86f47b173740616dd1af4e02537a5deb1ade52
// qa: card:B07001:934608b55c1b640bd5e5c1bf6dc33c3322750bdefd79b0a5e162289b809c3ad0
// qa: card:B07003:accf47f82e87c381577a50c21051cd8f4c040da9bf67cf224d7ccb3cd83252bd
// qa: card:B07003:cdeced21ac31590728e947e8ac9d755b7698532e0bb7eb83f3f288dc594464f8
// qa: card:B07004:0e8778bc75d72ebcd73bd21c7d81f547b11128d056f64b4457e321f5a1653fdf
// qa: card:B07004:657dafe95083ad08981b7610e34d651ff4ade221a78bb2a0482884c4475c0ff7
// qa: card:B07004:39774252ce93608575bcdb0a9138a8f6a2bcb44398c14e54541738e77e7cc14f
// qa: card:B07004:8c84ca4d897db6486c7b8176227093bbd708fb8bdf1e8ebd742838f8f43802c8

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07001 } from '@/cards/ct-p07/B07001';
import { B07001P } from '@/cards/ct-p07/B07001P';
import { B07001P2 } from '@/cards/ct-p07/B07001P2';
import { B07003 } from '@/cards/ct-p07/B07003';
import { B07003P } from '@/cards/ct-p07/B07003P';
import { B07004 } from '@/cards/ct-p07/B07004';
import { B07004P } from '@/cards/ct-p07/B07004P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
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

const BLUE_PARTNER = fixture('W164_BLUE_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const DUAL_TRAIT = fixture('W164_DUAL_TRAIT', {
  traits: ['少年探偵団', '毛利探偵事務所'],
});
const NON_MATCH = fixture('W164_NON_MATCH');
const TAIL = fixture('W164_TAIL', { kind: 'event' });
const ACTOR = fixture('W164_ACTOR', { ap: 3000 });
const CONTACT_TARGET = fixture('W164_CONTACT_TARGET', { ap: 2000 });
const AURA_CUTIN = fixture('W164_AURA_CUTIN', { kind: 'event' });
const LINKED_SCENE = fixture('W164_LINKED_SCENE', { names: ['江戸川コナン'] });
const LINKED_REMOVE = fixture('W164_LINKED_REMOVE', { names: ['江戸川コナン', '工藤新一'] });
const AYUMI_ENTRY = fixture('W164_AYUMI_ENTRY', { names: ['小嶋元太'], level: 8 });
const REFRESH_CARD = fixture('W164_REFRESH_CARD', { kind: 'event' });
const HAND_FODDER = fixture('W164_HAND_FODDER', { kind: 'event' });
const ENTER_OPTIONAL: AbilityDef = {
  id: 'enter-optional', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
  description: 'Wave164 entry-order sentinel.', ruleRefs: ['rules/15-abilities-effects.md'],
};
const AYUMI_OPTIONAL_ENTRY = fixture('W164_AYUMI_OPTIONAL_ENTRY', {
  names: ['円谷光彦'], level: 8, abilities: [ENTER_OPTIONAL],
});
const FIXTURES = [
  BLUE_PARTNER, DUAL_TRAIT, NON_MATCH, TAIL, ACTOR, CONTACT_TARGET, AURA_CUTIN,
  LINKED_SCENE, LINKED_REMOVE, AYUMI_ENTRY, REFRESH_CARD, HAND_FODDER,
  AYUMI_OPTIONAL_ENTRY,
];
const B07001_PRINTS = [B07001, B07001P, B07001P2] as const;
const B07003_PRINTS = [B07003, B07003P] as const;
const B07004_PRINTS = [B07004, B07004P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave164 state');
  return state;
}

function cardBacks(count: number) {
  return Array.from({ length: count }, () => ({
    type: 'card-back' as const, cardId: TAIL.id, faceUp: true,
  }));
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave164-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null, switchRemoveUid?: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
    ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function declare(card: CardDef, owner: Player, abilityIndex: number): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: `a${abilityIndex + 1}`,
    abilityOrigin: 'printed', abilityIndex,
  }), `${card.id} owner=${owner} declared`).toEqual({ ok: true });
}

function reachContactWindow(owner: Player): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'contact-actor', targetUid: 'contact-target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave164 contact ended before owner action window');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
      if (player === owner && uid === 'contact-actor') return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave164 owner contact window not reached');
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

describe('official QA Wave164: B07001/P/P2 declared rulings', () => {
  it.each(B07001_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner counts one dual-trait physical card once',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 164, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner.cardId = BLUE_PARTNER.id;
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      state.players[owner].deck = [DUAL_TRAIT.id, NON_MATCH.id, NON_MATCH.id, TAIL.id];
      install(state, owner, `${card.id}-${owner}-dual-trait`);

      declare(card, owner, 0);

      expect(read.char.ap(current(), 'source'), 'B07001/B07001P/B07001P2 dual trait counts once')
        .toBe(9000);
      expect(current().players[owner].remove).toEqual([DUAL_TRAIT.id, NON_MATCH.id, NON_MATCH.id]);
    },
  );

  it.each(B07001_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner grants Assault even with zero qualifying cost cards',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 164, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner.cardId = BLUE_PARTNER.id;
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      state.players[owner].deck = [NON_MATCH.id, NON_MATCH.id, NON_MATCH.id, TAIL.id];
      install(state, owner, `${card.id}-${owner}-zero-match`);

      declare(card, owner, 0);

      expect(read.char.ap(current(), 'source')).toBe(8000);
      expect(read.char.hasKeyword(current(), 'source', '突撃'), 'B07001/B07001P/B07001P2 zero match still grants Assault')
        .toBe(true);
    },
  );

  it.each(B07001_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may select its own scene occurrence for a2',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 164, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      install(state, owner, `${card.id}-${owner}-self-select`);

      declare(card, owner, 1);
      const pick = pendingPick(card.id, 'a2', 'charModifyLP');
      expect(pick.candidates.map(candidate => candidate.uid), 'B07001/B07001P/B07001P2 self candidate')
        .toContain('source');
      choose(pick, 'source');

      expect(read.char.lp(current(), 'source')).toBe(0);
      expect(read.char.hasTextAbility(current(), 'source', 'actionTargetsActive')).toBe(true);
    },
  );

  it.each(B07001_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner active-target grant does not bypass named-state action ban',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 164, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source', { isNamed: true })];
      state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'active-target')];
      install(state, owner, `${card.id}-${owner}-named-ban`);

      declare(card, owner, 1);
      choose(pendingPick(card.id, 'a2', 'charModifyLP'), 'source');
      expect(read.char.hasTextAbility(current(), 'source', 'actionTargetsActive'), 'B07001 grant is active before named gate')
        .toBe(true);

      expect(dispatchEngineAction({
        type: 'actionDeclareChar', byUid: 'source', targetUid: 'active-target',
      }), 'B07001/B07001P/B07001P2 named source remains unable to act')
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(useGameStateStore.getState().activeActionId).toBeNull();
    },
  );
});

describe('official QA Wave164: B07003/P hand Cut-In aura and linked entry choice', () => {
  it.each(B07003_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner uses a dynamically granted blue Cut-In normally',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 164, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(ACTOR.id, 'contact-actor')];
      state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'contact-target', { state: 'sleep' })];
      state.players[owner].hand = [card.id, AURA_CUTIN.id];
      install(state, owner, `${card.id}-${owner}-aura-cutin`);

      const actionId = reachContactWindow(owner);
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player: owner,
        choice: { kind: 'cutin', cardId: AURA_CUTIN.id },
      })).toEqual({ ok: true });

      expect(read.char.ap(current(), 'contact-actor'), 'B07003/B07003P granted Cut-In resolves AP')
        .toBe(4000);
      expect(current().players[owner].hand).toEqual([card.id]);
      expect(current().players[owner].remove, 'B07003/B07003P granted Cut-In card is removed')
        .toContain(AURA_CUTIN.id);
    },
  );

  it.each(B07003_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner cannot choose a remove-area follow-up after zero scene choice',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 164, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner.cardId = BLUE_PARTNER.id;
      state.players[owner].case.colors = ['青'];
      state.players[owner].file = cardBacks(8);
      state.players[owner].hand = [card.id];
      state.players[opponent].scene = [sceneChar(LINKED_SCENE.id, 'linked-scene', { state: 'sleep' })];
      state.players[opponent].remove = [LINKED_REMOVE.id];
      install(state, owner, `${card.id}-${owner}-zero-scene`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      const scenePick = pendingPick(card.id, 'a2', 'bindPick');
      expect(scenePick.candidates.map(candidate => candidate.uid)).toContain('linked-scene');
      choose(scenePick, null);

      expect(current().players[opponent].remove, 'B07003/B07003P zero scene pick preserves remove area')
        .toEqual([LINKED_REMOVE.id]);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
    },
  );
});

function b07004State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 164, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner.cardId = BLUE_PARTNER.id;
  state.players[owner].case.colors = ['青'];
  state.players[owner].scene = [sceneChar(card.id, 'source')];
  return state;
}

describe('official QA Wave164: B07004/P deck look and switch ordering', () => {
  it.each(B07004_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner declaration is legal with zero hand cards',
    ({ card, owner }) => {
      const state = b07004State(card, owner);
      state.players[owner].deck = [TAIL.id];
      install(state, owner, `${card.id}-${owner}-zero-hand`);

      declare(card, owner, 0);
      const reveal = pendingPick(card.id, 'a1', 'deckRevealUntil');
      expect(reveal).toMatchObject({ nMin: 0, nMax: 0 });
      choose(reveal, null);

      expect(current().players[owner].hand, 'B07004/B07004P zero hand remains legal')
        .toEqual([]);
      expect(current().players[owner].scene.find(character => character.uid === 'source')?.state)
        .toBe('sleep');
    },
  );

  it.each(B07004_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner refreshes after the sole looked-at entrant leaves the deck',
    ({ card, owner }) => {
      const state = b07004State(card, owner);
      state.players[owner].deck = [AYUMI_ENTRY.id];
      state.players[owner].remove = [REFRESH_CARD.id];
      state.players[owner].hand = [HAND_FODDER.id];
      install(state, owner, `${card.id}-${owner}-short-deck`);

      declare(card, owner, 0);
      const reveal = pendingPick(card.id, 'a1', 'deckRevealUntil');
      choose(reveal, reveal.candidates.find(candidate => candidate.cardId === AYUMI_ENTRY.id)!.uid);

      const discard = pendingPick(card.id, 'a1', 'discard');
      expect(current().refreshCount[owner], 'B07004/B07004P refresh occurs before trailing discard')
        .toBe(1);
      expect(current().players[owner].deck).toEqual([REFRESH_CARD.id]);
      choose(discard, discard.candidates[0]!.uid);
      expect(current().players[owner].scene.some(character => character.cardId === AYUMI_ENTRY.id))
        .toBe(true);
    },
  );

  it.each(B07004_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may decline a valid looked-at entrant',
    ({ card, owner }) => {
      const state = b07004State(card, owner);
      state.players[owner].deck = [AYUMI_ENTRY.id];
      install(state, owner, `${card.id}-${owner}-decline`);

      declare(card, owner, 0);
      const reveal = pendingPick(card.id, 'a1', 'deckRevealUntil');
      expect(reveal.candidates.map(candidate => candidate.cardId)).toEqual([AYUMI_ENTRY.id]);
      choose(reveal, null);

      expect(current().players[owner].scene.some(character => character.cardId === AYUMI_ENTRY.id), 'B07004/B07004P valid entrant may be declined')
        .toBe(false);
      expect(current().players[owner].deck).toEqual([AYUMI_ENTRY.id]);
      expect(current().players[owner].hand).toEqual([]);
    },
  );

  it.each(B07004_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may switch itself and finishes discard before entrant effect',
    ({ card, owner }) => {
      const state = b07004State(card, owner);
      for (let index = 0; index < 4; index += 1) {
        state.players[owner].scene.push(sceneChar(NON_MATCH.id, `fill-${index}`));
      }
      state.players[owner].deck = [AYUMI_OPTIONAL_ENTRY.id, TAIL.id];
      state.players[owner].hand = [HAND_FODDER.id];
      install(state, owner, `${card.id}-${owner}-switch-source`);

      declare(card, owner, 0);
      const reveal = pendingPick(card.id, 'a1', 'deckRevealUntil');
      choose(
        reveal,
        reveal.candidates.find(candidate => candidate.cardId === AYUMI_OPTIONAL_ENTRY.id)!.uid,
        'source',
      );

      const discard = pendingPick(card.id, 'a1', 'discard');
      expect(current().players[owner].scene.some(character => character.uid === 'source'), 'B07004/B07004P source switched out')
        .toBe(false);
      expect(current().players[owner].remove).toContain(card.id);
      expect(useGameStateStore.getState().pendingEffectOptional, 'B07004/B07004P entrant effect cannot overtake trailing discard')
        .toBeNull();
      choose(discard, discard.candidates[0]!.uid);

      surfacePendingSideChannels();
      expect(current().players[owner].remove, 'B07004/B07004P discard completes before entrant pending effect')
        .toEqual(expect.arrayContaining([card.id, HAND_FODDER.id]));
      const optional = useGameStateStore.getState().pendingEffectOptional;
      expect(optional).toMatchObject({
        source: { cardId: AYUMI_OPTIONAL_ENTRY.id, abilityId: 'enter-optional' },
      });
      expect(dispatchEngineAction(bindPendingDecision(optional!, {
        type: 'optionalResolve', run: true,
      }))).toEqual({ ok: true });
      expect(current().players[owner].hand).toEqual([TAIL.id]);
    },
  );
});

describe('official QA Wave164: B07004/P parent continuation precedes child owner order', () => {
  it.each(B07004_PRINTS.flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner resolves mandatory discard before ordering two entrant triggers',
    ({ card, owner }) => {
      const observer = fixture(`W164_OBSERVER_${owner}_${card.id}`, {
        abilities: [{
          id: 'observe-enter', type: 'triggered', scope: 'on-scene',
          trigger: { hook: 'enter' },
          effect: {
            kind: 'optional',
            effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          },
          description: 'Wave164 observer-order sentinel.',
          ruleRefs: ['rules/15-abilities-effects.md'],
        }],
      });
      register(observer);
      const state = b07004State(card, owner);
      state.players[owner].scene.push(sceneChar(observer.id, 'observer'));
      for (let index = 0; index < 3; index += 1) {
        state.players[owner].scene.push(sceneChar(NON_MATCH.id, `order-fill-${index}`));
      }
      state.players[owner].deck = [AYUMI_OPTIONAL_ENTRY.id, TAIL.id];
      state.players[owner].hand = [HAND_FODDER.id];
      install(state, owner, `${card.id}-${owner}-parent-before-two-children`);

      declare(card, owner, 0);
      const reveal = pendingPick(card.id, 'a1', 'deckRevealUntil');
      choose(
        reveal,
        reveal.candidates.find(candidate => candidate.cardId === AYUMI_OPTIONAL_ENTRY.id)!.uid,
        'source',
      );
      const discard = pendingPick(card.id, 'a1', 'discard');
      expect(useGameStateStore.getState().pendingEffectOptional, 'B07004 parent pick owns the boundary')
        .toBeNull();
      choose(discard, discard.candidates[0]!.uid);
      surfacePendingSideChannels();

      const group = current().pendingEffects.filter(entry => (
        entry.state === 'pending'
        && [AYUMI_OPTIONAL_ENTRY.id, observer.id].includes(entry.source.cardId ?? '')
      ));
      expect(group.map(entry => entry.source.cardId).sort(), 'B07004 child triggers await owner order')
        .toEqual([AYUMI_OPTIONAL_ENTRY.id, observer.id].sort());
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
      const observerEntry = group.find(entry => entry.source.cardId === observer.id)!;
      expect(dispatchEngineAction({
        type: 'setEffectOrder', entryId: observerEntry.id, order: 0, player: owner,
      })).toEqual({ ok: true });
      const ordered = current().pendingEffects
        .filter(entry => group.some(candidate => candidate.id === entry.id))
        .sort((left, right) => (left.ownerChosenOrder ?? Infinity) - (right.ownerChosenOrder ?? Infinity));
      expect(dispatchEngineAction({
        type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id),
      })).toEqual({ ok: true });
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingEffectOptional, 'B07004 chosen child resolves after parent')
        .toMatchObject({ source: { cardId: observer.id, abilityId: 'observe-enter' } });
    },
  );
});
