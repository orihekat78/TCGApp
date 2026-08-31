// qa: card:B09056:291fc09e63b332fbdca9e94aae30890f71c8741ec83bda8724ea0b58d7b8dfd9
// qa: card:B09056:5302873b710d2a6013bbca719807f088b656f140927e19a6e8ab2a7e6a6d699b
// qa: card:B09056:57247cdb00d687f5f6a06d3987bccc1e4a8db8305235ed012d4fdda21abd6dd3
// qa: card:B09057:674ddfc2479854991161980b6b17e67c29832295a9d8c6790a534b955c228d41
// qa: card:B09057:ee4ff12ae2f5d9aaa25b2b03a760a31f15b0d141c59c71aebf70ad2269611e12
// qa: card:B09060:4b9ed3ae16be0d13349f1dab20fb4be1753c986295c1ce7c6853f494d840ff44
// qa: card:B09063:4fb59cfc644032b36ff3acee74cdfdce39b0d1fd77a47e772c0606e2eb7d543f
// qa: card:B09064:0c2766a6353754c22e1dd3df8a1dfda2dfc29acce248c88f56cc9a0d778e4549

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09056 } from '@/cards/ct-p09/B09056';
import { B09056P } from '@/cards/ct-p09/B09056P';
import { B09057 } from '@/cards/ct-p09/B09057';
import { B09060 } from '@/cards/ct-p09/B09060';
import { B09063 } from '@/cards/ct-p09/B09063';
import { B09064 } from '@/cards/ct-p09/B09064';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

const LEVEL_EIGHT_A = fixture('W192_LEVEL_EIGHT_A', { level: 8 });
const LEVEL_EIGHT_B = fixture('W192_LEVEL_EIGHT_B', { level: 8 });
const LEVEL_SEVEN_BLOCKER = fixture('W192_LEVEL_SEVEN_BLOCKER', { level: 7 });
const RED_PARTNER = fixture('W192_RED_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 5, colors: ['赤'],
});
const FILLER = fixture('W192_FILLER');
const BLACK_LEVEL_THREE = fixture('W192_BLACK_LEVEL_THREE', { colors: ['黒'], level: 3 });
const BLACK_LEVEL_SIX = fixture('W192_BLACK_LEVEL_SIX', { colors: ['黒'], level: 6 });
const OWNER_COST = fixture('W192_OWNER_COST', { colors: ['黒'], level: 6 });
const OPPONENT_COST = fixture('W192_OPPONENT_COST', { colors: ['黒'], level: 6 });
const DUAL_TRAIT = fixture('W192_DUAL_TRAIT', { traits: ['FBI', '赤井家'] });
const FILE_CARD = fixture('W192_FILE_CARD');
const DRAW_A = fixture('W192_DRAW_A');
const DRAW_B = fixture('W192_DRAW_B');
const MILL_A = fixture('W192_MILL_A', { kind: 'event', level: undefined, ap: undefined, lp: undefined });
const MILL_B = fixture('W192_MILL_B', { kind: 'event', level: undefined, ap: undefined, lp: undefined });
const MILL_C = fixture('W192_MILL_C', { kind: 'event', level: undefined, ap: undefined, lp: undefined });
const REFRESH_CARD = fixture('W192_REFRESH', { kind: 'event', level: undefined, ap: undefined, lp: undefined });
const FIXTURES = [
  LEVEL_EIGHT_A, LEVEL_EIGHT_B, LEVEL_SEVEN_BLOCKER, RED_PARTNER, FILLER,
  BLACK_LEVEL_THREE, BLACK_LEVEL_SIX, OWNER_COST, OPPONENT_COST, DUAL_TRAIT,
  FILE_CARD, DRAW_A, DRAW_B, MILL_A, MILL_B, MILL_C, REFRESH_CARD,
];
const B09056_PRINTS = [B09056, B09056P] as const;
const MILL_ROWS = [B09056, B09056P, B09064] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave192 state');
  return state;
}

function fileCards(count: number): Array<{ type: 'card-back'; cardId: string }> {
  return Array.from({ length: count }, () => ({ type: 'card-back' as const, cardId: FILE_CARD.id }));
}

function install(state: GameState, label: string, owner: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave192-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function sourceUid(cardId: string, owner: Player): string {
  const source = current().players[owner].scene.find(character => character.cardId === cardId);
  if (!source) throw new Error(`missing Wave192 source ${cardId}/${owner}`);
  return source.uid;
}

function resolveOptional(cardId: string, owner: Player, run = true): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending, `${cardId}: optional authority`).toMatchObject({
    player: owner, source: { cardId, abilityId: 'a1' },
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run })))
    .toEqual({ ok: true });
}

function pendingPick(cardId: string, owner: Player, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${cardId}: ${atomVerb} authority`).toMatchObject({
    ownerPlayer: owner, atomVerb, source: { cardId, abilityId: 'a1' },
  });
  return pending!;
}

function choosePick(
  pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>,
  pickedUid: string | null,
  switchRemoveUid?: string,
): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function resolveChoice(cardId: string, owner: Player, choiceIndex: number): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectChoice;
  expect(pending, `${cardId}: choice authority`).toMatchObject({
    player: owner, source: { cardId, abilityId: 'a1' }, options: expect.any(Array),
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'choiceResolve', choiceIndex })))
    .toEqual({ ok: true });
}

function installB09063(owner: Player): void {
  const state = createEmptyGameState();
  state.turn = { number: 192, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤'];
  state.players[owner].file = fileCards(10);
  state.players[owner].scene = [sceneChar(B09063.id, 'source')];
  state.players[owner].hand = [LEVEL_EIGHT_A.id, LEVEL_EIGHT_B.id];
  state.players[owner].deck = [DRAW_A.id, DRAW_B.id];
  state.players[other(owner)].scene = [sceneChar(LEVEL_SEVEN_BLOCKER.id, 'blocker')];

  install(state, `B09063-${owner}`, owner);
}

function effectEntryState(card: CardDef, owner: Player, entrant: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 192, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤', '黒'];
  state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[owner].file = fileCards(10);
  state.players[owner].scene = Array.from({ length: 4 }, (_value, index) => (
    sceneChar(FILLER.id, `${owner}-filler-${index}`)
  ));
  state.players[owner].hand = [card.id];
  if (card.id === B09056.id || card.id === B09056P.id) {
    state.players[owner].remove = [entrant.id];
    state.scratchTrace[owner] = '発見済';
  } else {
    state.players[owner].hand.push(entrant.id);
  }
  return state;
}

function millState(card: CardDef, owner: Player): GameState {
  const target = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 192, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤', '黒'];
  state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[owner].file = fileCards(card.level ?? 0);
  state.players[owner].hand = [card.id];
  state.players[target].scene = [
    sceneChar(FILLER.id, `${target}-mill-one`), sceneChar(FILLER.id, `${target}-mill-two`),
  ];
  state.players[target].deck = [MILL_A.id, MILL_B.id, MILL_C.id];
  state.players[target].remove = [REFRESH_CARD.id];
  state.scratchTrace[owner] = '未発見';
  return state;
}

function b09057CostState(owner: Player, includeOwnerCost: boolean): GameState {
  const target = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 192, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
  state.scratchTrace[owner] = '発見済';
  state.players[owner].scene = [sceneChar(B09057.id, 'source', { state: 'sleep' })];
  if (includeOwnerCost) state.players[owner].scene.push(sceneChar(OWNER_COST.id, `${owner}-owner-cost`));
  state.players[target].scene = [sceneChar(OPPONENT_COST.id, `${target}-opponent-cost`)];
  state.players[owner].deck = [DRAW_A.id, DRAW_B.id];
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave192: public owner mirrors', () => {
  it.each(B09056_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner $owner may choose zero removal, then switch out the source for the found-trace entrant',
    ({ card, owner }) => {
      install(effectEntryState(card, owner, BLACK_LEVEL_THREE), `${card.id}-${owner}-zero-switch`, owner);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      const source = sourceUid(card.id, owner);
      resolveOptional(card.id, owner);
      const removal = pendingPick(card.id, owner, 'sceneRemove');
      expect(removal.nMin).toBe(0);
      choosePick(removal, null);
      resolveChoice(card.id, owner, 0);

      const entry = pendingPick(card.id, owner, 'sceneEnter');
      const target = entry.candidates.find(candidate => candidate.cardId === BLACK_LEVEL_THREE.id);
      expect(target, `${card.id}: exact black level-three entrant`).toBeTruthy();
      choosePick(entry, target!.uid, source);

      expect(current().players[owner].scene).toHaveLength(5);
      expect(current().players[owner].scene.some(character => character.uid === source)).toBe(false);
      expect(current().players[owner].scene.find(character => character.cardId === BLACK_LEVEL_THREE.id)?.state)
        .toBe('sleep');
      expect(current().players[owner].remove).toContain(card.id);
    },
  );

  it.each((['self', 'opp'] as const).map(owner => ({ owner })))(
    'B09057 owner $owner may switch out its newly entered source for the black hand entrant',
    ({ owner }) => {
      install(effectEntryState(B09057, owner, BLACK_LEVEL_SIX), `B09057-${owner}-switch`, owner);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B09057.id }))
        .toEqual({ ok: true });
      const source = sourceUid(B09057.id, owner);
      resolveOptional(B09057.id, owner);
      const entry = pendingPick(B09057.id, owner, 'sceneEnter');
      const target = entry.candidates.find(candidate => candidate.cardId === BLACK_LEVEL_SIX.id);
      expect(target, 'B09057 exact black level-six entrant').toBeTruthy();
      choosePick(entry, target!.uid, source);

      expect(current().players[owner].scene).toHaveLength(5);
      expect(current().players[owner].scene.some(character => character.uid === source)).toBe(false);
      expect(current().players[owner].scene.find(character => character.cardId === BLACK_LEVEL_SIX.id)?.state)
        .toBe('active');
      expect(current().players[owner].remove).toContain(B09057.id);
    },
  );

  it.each(MILL_ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner $owner mills only the short deck, refreshes once, and never mills the new deck',
    ({ card, owner }) => {
      const target = other(owner);
      install(millState(card, owner), `${card.id}-${owner}-short-mill`, owner);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      if (card.id === B09056.id || card.id === B09056P.id) {
        resolveOptional(card.id, owner);
        choosePick(pendingPick(card.id, owner, 'sceneRemove'), null);
        resolveChoice(card.id, owner, 1);
      }

      expect(current().refreshCount[target]).toBe(1);
      expect(current().players[target].deck).toHaveLength(4);
      expect(current().players[target].deck).toEqual(expect.arrayContaining([
        MILL_A.id, MILL_B.id, MILL_C.id, REFRESH_CARD.id,
      ]));
      expect(current().players[target].remove).toEqual([]);
    },
  );

  it.each(['self', 'opp'] as const)(
    'B09057 owner %s rejects an opponent-only declared cost, then pays with its own black character',
    owner => {
      install(b09057CostState(owner, false), `B09057-${owner}-opponent-only-cost`, owner);
      const before = JSON.stringify(current());
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);

      install(b09057CostState(owner, true), `B09057-${owner}-owner-cost`, owner);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toEqual({ ok: true });

      expect(current().players[owner].scene.some(character => character.cardId === OWNER_COST.id)).toBe(false);
      expect(current().players[owner].remove).toContain(OWNER_COST.id);
      expect(current().players[other(owner)].scene.some(character => character.cardId === OPPONENT_COST.id)).toBe(true);
      expect(current().players[owner].scene.find(character => character.uid === 'source')?.state).toBe('active');
      expect(current().players[owner].hand).toContain(DRAW_A.id);
      expect(readChar.hasKeyword(current(), 'source', '突撃[キャラ]')).toBe(true);
    },
  );

  it.each(['self', 'opp'] as const)(
    'B09060 owner %s applies both independent rewards for one FBI and Akai-family hand cost',
    owner => {
      const state = createEmptyGameState();
      state.turn = { number: 192, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].file = fileCards(7);
      state.players[owner].scene = [sceneChar(B09060.id, 'source')];
      state.players[owner].hand = [DUAL_TRAIT.id];
      install(state, `B09060-${owner}-dual-trait`, owner);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });

      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toContain(DUAL_TRAIT.id);
      expect(readChar.ap(current(), 'source')).toBe(6000);
      expect(readChar.hasKeyword(current(), 'source', '突撃[事件]')).toBe(true);
      expect(readChar.hasKeyword(current(), 'source', '突撃[キャラ]')).toBe(true);
    },
  );

  it.each(['self', 'opp'] as const)(
    'B09063 owner %s consumes its turn trigger even when the level-seven blocker prevents the draw',
    owner => {
      installB09063(owner);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: LEVEL_EIGHT_A.id }))
        .toEqual({ ok: true });
      expect(current().players[owner].deck).toEqual([DRAW_A.id, DRAW_B.id]);
      expect(readChar.declaredUseCount(current(), 'source', 'a2', {
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toBe(1);

      const unblocked = structuredClone(current());
      unblocked.players[other(owner)].scene = [];
      const second = mutate.scene.enter(unblocked, owner, LEVEL_EIGHT_B.id, {});
      event.emit(unblocked, 'enter', {
        uid: second.uid, viaEffect: true, enterOrder: 2, enterOrderThisTurn: 2,
      }, { player: owner, uid: second.uid, cardId: second.cardId });
      runAllUntilEmpty(unblocked);
      expect(useGameStateStore.getState().setGameState(unblocked)).toBe(true);

      expect(current().players[owner].deck).toEqual([DRAW_A.id, DRAW_B.id]);
      expect(readChar.declaredUseCount(current(), 'source', 'a2', {
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toBe(1);
    },
  );
});
