// qaId=card:B09090:44ef9075cc50199818343279be5b6a42af1aeacb78a152cf75bdc37dc7b5f7eb
// qaId=card:PR286:44ef9075cc50199818343279be5b6a42af1aeacb78a152cf75bdc37dc7b5f7eb
// Rules: 05, 13, 15, 16, 21. Public dispatcher coverage only.

import { beforeEach, describe, expect, it } from 'vitest';
import { B09090 } from '@/cards/ct-p09/B09090';
import { PR286 } from '@/cards/pr-01/PR286';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';

const QA = '44ef9075cc50199818343279be5b6a42af1aeacb78a152cf75bdc37dc7b5f7eb';
const CARDS = [B09090, PR286] as const;
const COST = 'QA_COST';
const PLAIN = 'QA_PLAIN';
const SHIPPU = 'QA_SHIPPU';
const OPP_PLAIN = 'QA_OPP_PLAIN';
const ENTRY_SOURCE = 'QA_ENTRY_SOURCE';
const ENTRY_SOURCE_UID = 'entry-source:self';
const DRAW = 'QA_DRAW';

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...options,
  };
}

const firstEntryDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: {
    hook: 'enter', selfOnly: true,
    matcherCondition: { kind: 'enterOrderEquals', n: 1 },
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '', ruleRefs: [],
};

function enterAbility(id: string, player: 'self' | 'opp', cardId: string): AbilityDef {
  return {
    id, type: 'declared', scope: 'on-scene',
    effect: { kind: 'atom', verb: 'sceneEnter', args: { player, cardId, viaEffect: true, target: { query: { area: 'remove', side: player } } } },
    description: '', ruleRefs: [],
  };
}

const entrySource = card(ENTRY_SOURCE, {
  abilities: [
    enterAbility('enter-plain', 'self', PLAIN),
    enterAbility('enter-shippu', 'self', SHIPPU),
    enterAbility('enter-opp', 'opp', OPP_PLAIN),
  ],
});

function base(caseCard: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = { cardId: caseCard.id, status: '解決編', requiredEvidence: 7, colors: caseCard.colors, declaredUseCount: {} };
  state.players.opp.case = { cardId: 'OPP_CASE', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  state.players.self.deck = [DRAW, 'FILLER'];
  state.players.self.file = ['FILE'];
  state.players.opp.deck = ['OPP_FILLER', 'OPP_FILLER', 'OPP_FILLER'];
  state.players.self.scene = [{
    cardId: ENTRY_SOURCE, uid: ENTRY_SOURCE_UID, state: 'active', isNamed: false,
    enterOrder: 1, setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  }];
  return state;
}

function install(state: GameState): void {
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: state });
}

function armThroughPublicDispatcher(): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: 'case:self', abilId: 'a2', costParams: { removeFromHand: { indices: [0] } },
  })).toEqual({ ok: true });
  expect(useGameStateStore.getState().gameState?.turnState.self.shippuWaiveArmed).toBe(true);
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  for (const cardDef of CARDS) register(cardDef);
  register(card(COST, { keywords: ['疾風'] }));
  register(card(PLAIN));
  register(card(SHIPPU, { abilities: [firstEntryDraw] }));
  register(card(OPP_PLAIN));
  register(entrySource);
  register(card(DRAW));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null, pendingEffectChoice: null });
});

describe('B09090 / PR286 next-entry shippu waiver', () => {
  it(`${QA}: next self entry alone ignores the shippu condition`, () => {
    expect(firstEntryDraw.trigger?.matcherCondition).toEqual({ kind: 'enterOrderEquals', n: 1 });
    for (const caseCard of CARDS) {
      const state = base(caseCard);
      state.players.self.hand = [COST];
      state.players.self.remove = [SHIPPU];
      state.turnState.self.enterCountThisTurn = 1;
      install(state);
      armThroughPublicDispatcher();

      expect(dispatchEngineAction({ type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: 'enter-shippu' }), `${caseCard.id}:${QA}: public second self entry`).toEqual({ ok: true });
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.hand, `${caseCard.id}:${QA}: waived first-entry trigger draws`).toEqual([DRAW]);
      const shippu = after.players.self.scene.find((entry) => entry.cardId === SHIPPU)!;
      expect(shippu.enterOrderThisTurn, `${caseCard.id}:${QA}: waived character was the second self entry`).toBe(2);
      expect(shippu.turnEffects.shippuWaived, `${caseCard.id}:${QA}: waiver was attached to the exact entrant`).toBe(true);
      expect(after.turnState.self.shippuWaiveArmed, `${caseCard.id}:${QA}: waiver was consumed`).toBe(false);
      expect(after.turnState.self.shippuFiredThisTurn, `${caseCard.id}:${QA}: waived shippu still counts as fired`).toBe(true);
    }
  });

  it(`${QA}: a non-shippu self entry consumes the waiver`, () => {
    for (const caseCard of CARDS) {
      const state = base(caseCard);
      state.players.self.hand = [COST];
      state.players.self.remove = [PLAIN, SHIPPU];
      install(state);
      armThroughPublicDispatcher();

      expect(dispatchEngineAction({ type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: 'enter-plain' }), `${caseCard.id}:${QA}: public non-shippu entry`).toEqual({ ok: true });
      const afterPlain = useGameStateStore.getState().gameState!;
      expect(afterPlain.players.self.scene.find((entry) => entry.cardId === PLAIN)?.turnEffects.shippuWaived, `${caseCard.id}:${QA}: non-shippu entrant consumed waiver`).toBe(true);
      expect(afterPlain.turnState.self.shippuWaiveArmed, `${caseCard.id}:${QA}: arm is gone before later shippu`).toBe(false);
      expect(dispatchEngineAction({ type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: 'enter-shippu' }), `${caseCard.id}:${QA}: public later shippu entry`).toEqual({ ok: true });
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.scene.map((entry) => entry.cardId), `${caseCard.id}:${QA}: plain then shippu self entries`).toEqual([ENTRY_SOURCE, PLAIN, SHIPPU]);
      expect(after.players.self.hand, `${caseCard.id}:${QA}: later shippu cannot use consumed waiver`).toEqual([]);
      expect(after.players.self.scene.find((entry) => entry.cardId === SHIPPU)?.turnEffects.shippuFiredCharThisTurn, `${caseCard.id}:${QA}: second shippu did not fire`).toBeUndefined();
    }
  });

  it(`${QA}: opponent entry leaves the self waiver for the later self entrant`, () => {
    for (const caseCard of CARDS) {
      const state = base(caseCard);
      state.players.self.hand = [COST];
      state.players.self.remove = [SHIPPU];
      state.players.opp.remove = [OPP_PLAIN];
      state.turnState.self.enterCountThisTurn = 1;
      install(state);
      armThroughPublicDispatcher();

      expect(dispatchEngineAction({ type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: 'enter-opp' }), `${caseCard.id}:${QA}: public opponent entry`).toEqual({ ok: true });
      const afterOpponent = useGameStateStore.getState().gameState!;
      expect(afterOpponent.players.opp.scene.map((entry) => entry.cardId), `${caseCard.id}:${QA}: opponent entrant is present`).toEqual([OPP_PLAIN]);
      expect(afterOpponent.turnState.self.shippuWaiveArmed, `${caseCard.id}:${QA}: opponent entry did not consume self arm`).toBe(true);
      expect(dispatchEngineAction({ type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: 'enter-shippu' }), `${caseCard.id}:${QA}: public second self entry after opponent`).toEqual({ ok: true });
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.hand, `${caseCard.id}:${QA}: opponent entry did not consume self waiver`).toEqual([DRAW]);
      expect(after.players.self.scene.find((entry) => entry.cardId === SHIPPU)?.turnEffects.shippuWaived, `${caseCard.id}:${QA}: exact later self entrant consumed waiver`).toBe(true);
    }
  });

  it(`${QA}: public turn boundary clears an unused waiver`, () => {
    for (const caseCard of CARDS) {
      const state = base(caseCard);
      state.players.self.hand = [COST];
      install(state);
      armThroughPublicDispatcher();

      expect(useGameStateStore.getState().gameState?.turnState.self.shippuWaiveArmed, `${caseCard.id}:${QA}: arm exists before boundary`).toBe(true);
      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' }), `${caseCard.id}:${QA}: public turn end`).toEqual({ ok: true });
      expect(useGameStateStore.getState().gameState?.turnState.self.shippuWaiveArmed, `${caseCard.id}:${QA}: next-turn boundary clears arm`).toBe(false);
    }
  });
});
