// qa: card:B07017:077dd7a61a20a31e5929ca294e5fed39ecfd7fd9c913426e4dc297ce71780ae9
// qa: card:B07017:0bbcb5eb4bf6c1cfffa312ec7869057fa916c450d340219a9fe32c3560369265
// qa: card:B07020:61dcd29262634521aaa07d0e63dcc1e0805849b9cc9f90d3910b3ac1f4f75d91
// qa: card:B07023:5796cf238d7e1334d2da12301ab3898e51abb57d6a61d7a188c6c931f5f2266e
// qa: card:B07024:fe57a813449ca122c4da650d6a548969360425c94dc6a81ea4ea72958d35145b
// qa: card:B07030:0c958ddd2d58ad6b8d6624d3846320994b2699a74e8aa141b64f89eb64c59c8e
// qa: card:B07030:0556066518d4d9fc09a46fdca9214b9875803910fa24c8f20cd448344bbbaa4d
// qa: card:B07030:da4f4586fbf7cb88b9ba24d1241d31649e6d6730540fe81e1b1fe48b635a8cb1
// qa: card:B07030:43880971e2664248b7392f8218efc59b88a7a1812214721e4828dbe6ca9c2cbc

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07017 } from '@/cards/ct-p07/B07017';
import { B07017P } from '@/cards/ct-p07/B07017P';
import { B07020 } from '@/cards/ct-p07/B07020';
import { B07020P } from '@/cards/ct-p07/B07020P';
import { B07023 } from '@/cards/ct-p07/B07023';
import { B07023P } from '@/cards/ct-p07/B07023P';
import { B07024 } from '@/cards/ct-p07/B07024';
import { B07030 } from '@/cards/ct-p07/B07030';
import { B07030P } from '@/cards/ct-p07/B07030P';
import { B07030P2 } from '@/cards/ct-p07/B07030P2';
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
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const WHITE_PARTNER = fixture('W166_WHITE_PARTNER', {
  kind: 'partner', colors: ['白'], level: undefined, ap: undefined, lp: 1,
});
const MOMIJI = fixture('W166_MOMIJI', { names: ['大岡紅葉'] });
const CONTACT_TARGET = fixture('W166_CONTACT_TARGET', { ap: 1000 });
const GREEN_EVENT = fixture('W166_GREEN_EVENT', { kind: 'event', level: 6 });
const MARO = fixture('W166_MARO', { names: ['マロちゃん'], level: 5 });
const HAND_COST = fixture('W166_HAND_COST', { kind: 'event' });
const DRAW = fixture('W166_DRAW', { kind: 'event' });
const LEVEL8 = fixture('W166_LEVEL8', { level: 8 });
const FODDER = fixture('W166_FODDER', { kind: 'event' });
const JEWEL = fixture('W166_JEWEL', { kind: 'event', colors: ['白'], traits: ['ビッグジュエル'] });
const WHITE_ENTRY_DRAW: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Wave166 enter sentinel.', ruleRefs: ['rules/17-icons.md'],
};
const WHITE_ENTRY = fixture('W166_WHITE_ENTRY', {
  colors: ['白'], level: 3, abilities: [WHITE_ENTRY_DRAW],
});
const KAITO = fixture('W166_KAITO', { names: ['怪盗キッド'], colors: ['白'] });
const FILLER = fixture('W166_FILLER', { colors: ['白'] });
const ENTER_CASE = fixture('W166_ENTER_CASE', {
  kind: 'case', level: undefined, ap: undefined, lp: undefined,
  abilities: [{
    id: 'a1', type: 'declared', scope: 'always',
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: { player: 'self', from: 'hand', cardId: LEVEL8.id, viaEffect: true },
    },
    description: 'Wave166 repeat-entry fixture.', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const FIXTURES = [
  WHITE_PARTNER, MOMIJI, CONTACT_TARGET, GREEN_EVENT, MARO, HAND_COST, DRAW,
  LEVEL8, FODDER, JEWEL, WHITE_ENTRY, KAITO, FILLER, ENTER_CASE,
];
const B07017_PRINTS = [B07017, B07017P] as const;
const B07020_PRINTS = [B07020, B07020P] as const;
const B07023_PRINTS = [B07023, B07023P] as const;
const B07030_PRINTS = [B07030, B07030P, B07030P2] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave166 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave166-${label}`);
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

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function driveEffectContactToJudge(actionId: string): void {
  for (let step = 0; step < 16; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave166 effect contact ended before judge');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      return;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave166 effect contact judge not reached');
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

describe('official QA Wave166: B07017/P contact observer and Bond scope', () => {
  it.each(B07017_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner reacts after an effect-generated contact without Bond',
    ({ card, owner }) => {
      // Card-bound physical rows: B07017 B07017P.
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 166, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active' })];
      state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'target', { state: 'active' })];
      state.players[owner].remove = [GREEN_EVENT.id];
      state.players.self.deck = [DRAW.id, DRAW.id];
      state.players.opp.deck = [DRAW.id, DRAW.id];
      const action = flow.action.startFromEffect(state, 'source', 'target');
      expect(action).toBeTruthy();
      install(state, owner, `${card.id}-${owner}-effect-contact`);

      driveEffectContactToJudge(action!.id);
      expect(current().players[opponent].scene.some(character => character.uid === 'target')).toBe(false);
      const pick = pendingPick(card.id, 'a2', 'handAddFromRemove');
      const eventCard = pick.candidates.find(candidate => candidate.cardId === GREEN_EVENT.id)!;
      choose(pick, eventCard.uid);
      expect(current().players[owner].hand).toContain(GREEN_EVENT.id);
      expect(current().players[owner].remove).not.toContain(GREEN_EVENT.id);
    },
  );

  it.each(B07017_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner Bond changes AP only',
    ({ card, owner }) => {
      // Card-bound physical rows: B07017 B07017P.
      const state = createEmptyGameState();
      state.turn.player = owner;
      state.players[owner].scene = [
        sceneChar(card.id, 'source'),
        sceneChar(MOMIJI.id, 'momiji'),
      ];
      state.players[other(owner)].scene = [sceneChar(MOMIJI.id, 'opp-momiji')];
      expect(read.char.ap(state, 'source')).toBe(6000);
      expect(read.char.keywords(state, 'source')).toContain('突撃[キャラ]');
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      expect(read.char.ap(state, 'source')).toBe(5000);
      expect(read.char.keywords(state, 'source')).toContain('突撃[キャラ]');
    },
  );
});

describe('official QA Wave166: B07020/P cost card may re-enter', () => {
  it.each(B07020_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner exposes the just-paid hand occurrence in the remove entry pick',
    ({ card, owner }) => {
      // Card-bound physical rows: B07020 B07020P.
      const state = createEmptyGameState();
      state.turn = { number: 166, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active' })];
      state.players[owner].hand = [MARO.id];
      state.players[other(owner)].hand = [HAND_COST.id];
      state.players.self.deck = [DRAW.id, DRAW.id];
      state.players.opp.deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-paid-entry`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });

      const pick = pendingPick(card.id, 'a1', 'sceneEnter');
      expect(current().players[owner].remove).toContain(MARO.id);
      expect(current().players[other(owner)].hand).toEqual([HAND_COST.id]);
      const paid = pick.candidates.find(candidate => candidate.cardId === MARO.id)!;
      choose(pick, paid.uid);
      expect(current().players[owner].scene.some(character => character.cardId === MARO.id)).toBe(true);
      expect(current().players[owner].remove).not.toContain(MARO.id);
    },
  );
});

describe('official QA Wave166: B07023/P zero-target end trigger', () => {
  it.each(B07023_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may remove itself with no Hattori or Kogoro target',
    ({ card, owner }) => {
      // Card-bound physical rows: B07023 B07023P.
      const state = createEmptyGameState();
      state.turn = { number: 166, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      state.players.self.deck = [DRAW.id, DRAW.id];
      state.players.opp.deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-zero-end`);
      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      resolveOptional(card.id, 'a1', true);
      surfacePendingSideChannels();
      expect(current().players[owner].scene).toHaveLength(0);
      expect(current().players[owner].remove).toContain(card.id);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    },
  );
});

describe('official QA Wave166: B07024 has no per-turn trigger limit', () => {
  it('surfaces and resolves twice for two level-8 opposing entries in one turn', () => {
    // Card-bound physical row: B07024.
    const state = createEmptyGameState();
    state.turn = { number: 166, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B07024.id, 'source')];
    state.players.self.hand = [FODDER.id];
    state.players.self.deck = [DRAW.id, DRAW.id, DRAW.id];
    state.players.opp.case = { ...state.players.opp.case, cardId: ENTER_CASE.id };
    state.players.opp.hand = [LEVEL8.id, LEVEL8.id];
    state.players.opp.deck = [DRAW.id, DRAW.id];
    install(state, 'self', 'B07024-repeat');

    for (let occurrence = 0; occurrence < 2; occurrence += 1) {
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'case:opp', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      resolveOptional(B07024.id, 'a1', true);
      const discard = pendingPick(B07024.id, 'a1', 'discard');
      choose(discard, discard.candidates[0]!.uid);
    }

    expect(current().players.opp.scene.filter(character => character.cardId === LEVEL8.id)).toHaveLength(2);
    expect(current().players.self.remove).toHaveLength(2);
  });
});

function b07030A1State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 166, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[owner].scene = [sceneChar(card.id, 'source')];
  state.players[other(owner)].scene = [sceneChar(CONTACT_TARGET.id, 'target')];
  state.players[owner].remove = [JEWEL.id];
  state.players.self.deck = [DRAW.id, DRAW.id];
  state.players.opp.deck = [DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave166: B07030/P/P2 independent choices', () => {
  it.each(B07030_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may decline the character and still move the jewel',
    ({ card, owner }) => {
      // Card-bound physical rows: B07030 B07030P B07030P2.
      install(b07030A1State(card, owner), owner, `${card.id}-${owner}-decline-char`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      choose(pendingPick(card.id, 'a1', 'sceneToDeck'), null);
      const jewelPick = pendingPick(card.id, 'a1', 'toPartnerArea');
      choose(jewelPick, jewelPick.candidates.find(candidate => candidate.cardId === JEWEL.id)!.uid);
      expect(current().players[other(owner)].scene.some(character => character.uid === 'target')).toBe(true);
      expect(current().players[owner].partnerAreaCards).toContain(JEWEL.id);
    },
  );

  it.each(B07030_PRINTS)('$id may move the character and decline the jewel', card => {
    // Card-bound physical rows: B07030 B07030P B07030P2.
    install(b07030A1State(card, 'self'), 'self', `${card.id}-decline-jewel`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    choose(pendingPick(card.id, 'a1', 'sceneToDeck'), 'target');
    choose(pendingPick(card.id, 'a1', 'toPartnerArea'), null);
    expect(current().players.opp.scene).toHaveLength(0);
    expect(current().players.opp.deck.at(-1)).toBe(CONTACT_TARGET.id);
    expect(current().players.self.remove).toContain(JEWEL.id);
  });
});

function b07030A2State(card: CardDef, owner: Player, inPartnerArea = false): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 166, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area' };
  if (inPartnerArea) {
    state.players[owner].partnerAreaMR = sceneChar(card.id, `partnerMR:${owner}`);
  } else {
    state.players[owner].scene = [sceneChar(card.id, 'source'), ...Array.from(
      { length: 4 },
      (_, index) => sceneChar(FILLER.id, `full-${index}`),
    )];
  }
  state.players[owner].partnerAreaCards = [JEWEL.id, JEWEL.id];
  state.players[owner].hand = [WHITE_ENTRY.id];
  state.players.self.deck = [DRAW.id, DRAW.id];
  state.players.opp.deck = [DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave166: B07030/P/P2 name gate, switch, and enter trigger', () => {
  it.each(B07030_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner scene source self-satisfies and may switch itself for an entrant trigger',
    ({ card, owner }) => {
      // Card-bound physical rows: B07030 B07030P B07030P2.
      install(b07030A2State(card, owner), owner, `${card.id}-${owner}-self-switch`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { partnerAreaRemove: { ids: [JEWEL.id, JEWEL.id] } },
      })).toEqual({ ok: true });
      const entry = pendingPick(card.id, 'a2', 'sceneEnter');
      const target = entry.candidates.find(candidate => candidate.cardId === WHITE_ENTRY.id)!;
      choose(entry, target.uid, 'source');

      expect(current().players[owner].scene).toHaveLength(5);
      expect(current().players[owner].scene.find(character => character.cardId === WHITE_ENTRY.id)?.state).toBe('sleep');
      expect(current().players[owner].scene.some(character => character.uid === 'source')).toBe(false);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([card.id, JEWEL.id, JEWEL.id]));
      expect(current().players[owner].hand).toContain(DRAW.id);
    },
  );

  it('partner-area source needs another Kaito or Kid in scene', () => {
    // Card-bound physical rows: B07030 B07030P B07030P2.
    const rejected = b07030A2State(B07030, 'self', true);
    install(rejected, 'self', 'B07030-pa-name-negative');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { partnerAreaRemove: { ids: [JEWEL.id, JEWEL.id] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.partnerAreaCards).toEqual([JEWEL.id, JEWEL.id]);

    const accepted = b07030A2State(B07030, 'self', true);
    accepted.players.self.scene = [sceneChar(KAITO.id, 'other-kaito')];
    install(accepted, 'self', 'B07030-pa-name-positive');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { partnerAreaRemove: { ids: [JEWEL.id, JEWEL.id] } },
    })).toEqual({ ok: true });
    choose(pendingPick(B07030.id, 'a2', 'sceneEnter'), null);
    expect(current().players.self.partnerAreaCards).toEqual([]);
  });
});
