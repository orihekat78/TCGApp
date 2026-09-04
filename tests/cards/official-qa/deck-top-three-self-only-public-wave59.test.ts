// qa: card:B04077:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
// qa: card:B06020:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
// qa: card:B07001:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
// qa: card:B08025:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
// qa: card:B10089:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
// qa: card:PR292:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
// qa: card:PR298:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
// Rules: 08-contact, 14-refresh, 15-abilities-effects, 16-card-set, 21-declared-ability-cost.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { startCausalSession } from '@/engine/log/causal';
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

type BaseId = 'B04077' | 'B06020' | 'B07001' | 'B08025' | 'B10089' | 'PR292' | 'PR298';
type Row = {
  cardId: string;
  baseId: BaseId;
  abilityId: 'a1' | 'a2';
  abilityIndex: 0 | 1;
  sleeps: boolean;
  limited: boolean;
};

const PRINTINGS: Row[] = [
  { cardId: 'B04077', baseId: 'B04077', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B04077P', baseId: 'B04077', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B06020', baseId: 'B06020', abilityId: 'a2', abilityIndex: 1, sleeps: true, limited: false },
  { cardId: 'B07001', baseId: 'B07001', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B07001P', baseId: 'B07001', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B07001P2', baseId: 'B07001', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B08025', baseId: 'B08025', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B08025P', baseId: 'B08025', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B10089', baseId: 'B10089', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'PR292', baseId: 'PR292', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
  { cardId: 'PR298', baseId: 'PR298', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
];

const BASE_ROWS = PRINTINGS.filter(row => row.cardId === row.baseId);
const SLEEP_ROWS = PRINTINGS.filter(row => row.sleeps);
const SOURCE_UID = 'wave59-source';
const PARTNER = 'W59-PARTNER';
const COST_A = 'W59-COST-A';
const COST_B = 'W59-COST-B';
const COST_C = 'W59-COST-C';
const TAIL = 'W59-TAIL';
const OPP_A = 'W59-OPP-A';
const OPP_B = 'W59-OPP-B';
const OPP_C = 'W59-OPP-C';
const OPP_TAIL = 'W59-OPP-TAIL';
const POLICE_COST = 'W59-POLICE-COST';
const ACTION_TARGET = 'W59-ACTION-TARGET';
const CONTACT_TARGET = 'W59-CONTACT-TARGET';
const KIDS_COST = 'W59-KIDS-COST';
const BOTH_TRAITS_COST = 'W59-BOTH-TRAITS-COST';
const MOMIJI_COST = 'W59-MOMIJI-COST';
const SET_TOP = 'W59-SET-TOP';
const LOW_REMOVE_TARGET = 'W59-LOW-REMOVE-TARGET';
const HIGH_REMOVE_DECOY = 'W59-HIGH-REMOVE-DECOY';
const BLACK_CUTIN_A = 'W59-BLACK-CUTIN-A';
const BLACK_CUTIN_B = 'W59-BLACK-CUTIN-B';
const BLACK_CUTIN_C = 'W59-BLACK-CUTIN-C';
const BLACK_L8_CUTIN = 'W59-BLACK-L8-CUTIN';

const cutinAbility: AbilityDef = {
  id: 'cutin', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'noop', args: {} },
  description: '【カットイン】AP+1000', ruleRefs: ['rules/09-cutin-disguise.md'],
};

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], traits: [], level: 1,
    ap: kind === 'character' ? 1000 : undefined, lp: kind === 'character' ? 1 : undefined,
    keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const fixtures: CardDef[] = [
  fixture(PARTNER, { kind: 'partner', colors: ['青', '緑', '白', '黄', '赤', '黒'], lp: 5 }),
  fixture(COST_A), fixture(COST_B), fixture(COST_C), fixture(TAIL),
  fixture(OPP_A), fixture(OPP_B), fixture(OPP_C), fixture(OPP_TAIL),
  fixture(POLICE_COST, { traits: ['警察'] }), fixture(ACTION_TARGET),
  fixture(CONTACT_TARGET, { ap: 7000 }),
  fixture(KIDS_COST, { traits: ['少年探偵団'] }),
  fixture(BOTH_TRAITS_COST, { traits: ['少年探偵団', '毛利探偵事務所'] }),
  fixture(MOMIJI_COST, { names: ['大岡紅葉'] }), fixture(SET_TOP),
  fixture(LOW_REMOVE_TARGET, { level: 7, ap: 7000 }), fixture(HIGH_REMOVE_DECOY, { level: 8, ap: 9000 }),
  fixture(BLACK_CUTIN_A, { colors: ['黒'], abilities: [cutinAbility] }),
  fixture(BLACK_CUTIN_B, { colors: ['黒'], abilities: [cutinAbility] }),
  fixture(BLACK_CUTIN_C, { colors: ['黒'], abilities: [cutinAbility] }),
  fixture(BLACK_L8_CUTIN, { colors: ['黒'], level: 8, abilities: [cutinAbility] }),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave59 state');
  return state;
}

function baseState(row: Row, owner: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].case = { ...state.players[owner].case, status: '解決編' };
  state.players[owner].scene = [sceneChar(row.cardId, SOURCE_UID, { state: 'active' })];
  state.players.self.deck = [];
  state.players.opp.deck = [];
  return state;
}

function install(state: GameState, label: string, human: Player = 'self'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function dispatch(row: Row) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: SOURCE_UID, abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
  });
}

function sourceOf(row: Row) {
  return {
    cardId: row.cardId, uid: SOURCE_UID, abilityId: row.abilityId,
    abilityOrigin: 'printed' as const, abilityIndex: row.abilityIndex,
  };
}

function pendingPick(row: Row, verb: string) {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb, `${row.cardId}: pending verb`).toBe(verb);
  expect(pick?.source, `${row.cardId}: physical source authority`).toMatchObject(sourceOf(row));
  return pick!;
}

function resolvePick(row: Row, verb: string, targetUid: string): void {
  const pick = pendingPick(row, verb);
  expect(pick.candidates.map(entry => entry.uid), `${row.cardId}: target candidates`).toContain(targetUid);
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: targetUid,
  }))).toEqual({ ok: true });
}

function decisionKinds(): string[] {
  const store = useGameStateStore.getState();
  return [
    ['pick', store.pendingEffectPick], ['choice', store.pendingEffectChoice],
    ['optional', store.pendingEffectOptional], ['deck-place', store.pendingDeckPlace],
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
}

function expectSettled(): void {
  surfacePendingSideChannels();
  expect(decisionKinds()).toEqual([]);
  expect(current().pendingRuntimeState).toBeUndefined();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave59: deck-top-three cost uses only the ability owner deck', () => {
  // Card-bound physical rows: B04077/P B06020 B07001/P/P2 B08025/P B10089 PR292 PR298.
  it.each(PRINTINGS)('$cardId removes exact top three from its own deck in order', row => {
    const state = baseState(row);
    state.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    const opponentDeck = [...state.players.opp.deck];
    install(state, `${row.cardId}:wave59-positive`);

    expect(dispatch(row), `${row.cardId}: own top-three payment accepted`).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.cardId, `${row.cardId}: physical source retained`).toBe(row.cardId);
    expect(current().players.self.remove, `${row.cardId}: exact top-three identity/order`).toEqual([COST_A, COST_B, COST_C]);
    expect(current().players.self.deck, `${row.cardId}: unrevealed owner tail remains`).toEqual([TAIL]);
    expect(current().players.opp.deck, `${row.cardId}: opponent deck isolated`).toEqual(opponentDeck);
    expect(current().players.opp.remove, `${row.cardId}: opponent remove isolated`).toEqual([]);
    expect(current().players.self.scene[0]?.state, `${row.cardId}: compound sleep cost`).toBe(row.sleeps ? 'sleep' : 'active');
    if (row.limited) {
      expect(readChar.declaredUseCount(current(), SOURCE_UID, row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      }), `${row.cardId}: exact occurrence consumes turn use`).toBe(1);
    }
  });

  it.each(BASE_ROWS)('$cardId rejects a short owner deck despite a full opponent deck', row => {
    for (const ownerDeck of [[], [COST_A], [COST_A, COST_B]]) {
      const state = baseState(row);
      state.players.self.deck = [...ownerDeck];
      state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
      install(state, `${row.cardId}:wave59-short-${ownerDeck.length}`);
      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(dispatch(row), `${row.cardId}: owner deck ${ownerDeck.length} rejects`)
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(current(), `${row.cardId}: short deck preserves reference`).toBe(before);
      expect(JSON.stringify(current()), `${row.cardId}: short deck preserves semantics`).toBe(beforeJson);
      expect(decisionKinds(), `${row.cardId}: short deck opens no decision`).toEqual([]);
      expect(current().pendingRuntimeState, `${row.cardId}: short deck opens no runtime`).toBeUndefined();
    }
  });

  it('B04077 pays an exact three-card deck and refreshes before its effect', () => {
    const row = PRINTINGS.find(entry => entry.cardId === 'B04077')!;
    const state = baseState(row);
    state.players.self.deck = [COST_A, COST_B, COST_C];
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    install(state, 'B04077:wave59-exact-three-refresh');

    expect(dispatch(row)).toEqual({ ok: true });
    expect([...current().players.self.deck].sort()).toEqual([COST_A, COST_B, COST_C].sort());
    expect(current().players.self.remove).toEqual([]);
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.opp.evidence).toHaveLength(1);
    expect(current().scratchTrace.opp).toBe('発見済');
    expect(current().players.opp.deck).toEqual([OPP_A, OPP_B, OPP_C, OPP_TAIL]);
    expect(readChar.declaredUseCount(current(), SOURCE_UID, 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
    expectSettled();
  });

  it.each(SLEEP_ROWS)('$cardId rejects a full deck when sleepSelf is unavailable', row => {
    const state = baseState(row);
    state.players.self.scene[0]!.state = 'sleep';
    state.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    install(state, `${row.cardId}:wave59-sleep-unavailable`);
    const before = current();
    const beforeJson = JSON.stringify(before);

    expect(dispatch(row)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(current().refreshCount.self).toBe(0);
    expect(current().players.opp.evidence).toEqual([]);
    expect(current().scratchTrace.opp).toBe('未発見');
    expect(decisionKinds()).toEqual([]);
    expect(current().pendingRuntimeState).toBeUndefined();
  });

  it('resolves self relative to an opponent-owned physical B06020 source', () => {
    const row = PRINTINGS.find(entry => entry.cardId === 'B06020')!;
    const state = baseState(row, 'opp');
    state.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    install(state, 'B06020:wave59-owner-relative', 'opp');

    expect(dispatch(row)).toEqual({ ok: true });
    expect(current().players.opp.remove).toEqual([OPP_A, OPP_B, OPP_C]);
    expect(current().players.opp.deck).toEqual([OPP_TAIL]);
    expect(current().players.self.remove).toEqual([]);
    expect(current().players.self.deck).toEqual([COST_A, COST_B, COST_C, TAIL]);
    expect(current().players.opp.scene[0]?.state).toBe('sleep');
  });

  it.each(BASE_ROWS)('$cardId reaches its printed effect after the same owner top-three payment', row => {
    const state = baseState(row);
    state.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    switch (row.baseId) {
      case 'B04077':
        state.players.self.deck = [POLICE_COST, COST_B, COST_C, TAIL];
        state.players.self.scene.push(sceneChar(ACTION_TARGET, 'action-target'));
        break;
      case 'B06020':
        state.players.opp.scene = [sceneChar(CONTACT_TARGET, 'contact-target')];
        break;
      case 'B07001':
        state.players.self.deck = [KIDS_COST, BOTH_TRAITS_COST, COST_C, TAIL];
        break;
      case 'B08025':
        state.players.self.deck = [MOMIJI_COST, COST_B, COST_C, SET_TOP, TAIL];
        state.players.opp.scene = [
          sceneChar(LOW_REMOVE_TARGET, 'low-remove-target'),
          sceneChar(HIGH_REMOVE_DECOY, 'high-remove-decoy'),
        ];
        break;
      case 'B10089':
        state.players.self.deck = [BLACK_CUTIN_A, BLACK_CUTIN_B, BLACK_CUTIN_C, TAIL];
        state.players.self.scene.push(sceneChar(BLACK_L8_CUTIN, 'black-l8-cutin'));
        break;
      case 'PR292':
      case 'PR298':
        state.players.self.deck = [BLACK_CUTIN_A, BLACK_CUTIN_B, BLACK_CUTIN_C, TAIL];
        state.players.opp.scene = [
          sceneChar(LOW_REMOVE_TARGET, 'low-remove-target'),
          sceneChar(HIGH_REMOVE_DECOY, 'high-remove-decoy'),
        ];
        break;
    }
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    install(state, `${row.cardId}:wave59-effect-sentinel`);
    expect(dispatch(row)).toEqual({ ok: true });

    switch (row.baseId) {
      case 'B04077':
        expect(current().players.self.scene.find(entry => entry.uid === 'action-target')?.turnEffects.actionTargetsActive)
          .not.toBe(true);
        resolvePick(row, 'charSetTurnEffect', 'action-target');
        expect(current().players.self.scene.find(entry => entry.uid === 'action-target')?.turnEffects.actionTargetsActive)
          .toBe(true);
        break;
      case 'B06020': {
        expect(useGameStateStore.getState().activeActionId).toBeNull();
        resolvePick(row, 'bindPick', 'contact-target');
        const actionId = useGameStateStore.getState().activeActionId;
        expect(actionId).toBeTruthy();
        expect(flow.action._getContext(current(), actionId!)).toMatchObject({
          byUid: SOURCE_UID, byPlayer: 'self', generatedByEffect: true,
          target: { kind: 'char', uid: 'contact-target' },
        });
        expect(current().players.self.scene[0]?.state).toBe('sleep');
        break;
      }
      case 'B07001':
        expect(readChar.ap(current(), SOURCE_UID)).toBe(10000);
        expect(readChar.hasKeyword(current(), SOURCE_UID, '突撃')).toBe(true);
        break;
      case 'B08025':
        expect(current().players.opp.scene.some(entry => entry.uid === 'low-remove-target')).toBe(true);
        expect(current().players.self.scene[0]?.setCards).toEqual([]);
        resolvePick(row, 'sceneRemove', 'low-remove-target');
        expect(current().players.opp.remove).toContain(LOW_REMOVE_TARGET);
        expect(current().players.opp.scene.some(entry => entry.uid === 'high-remove-decoy')).toBe(true);
        expect(current().players.self.scene[0]?.setCards).toEqual([
          expect.objectContaining({ cardId: SET_TOP, faceUp: false }),
        ]);
        expect(current().players.self.deck).toEqual([TAIL]);
        break;
      case 'B10089':
        expect(readChar.hasKeyword(current(), 'black-l8-cutin', '突撃')).toBe(false);
        resolvePick(row, 'charGrantKeyword', 'black-l8-cutin');
        expect(readChar.hasKeyword(current(), 'black-l8-cutin', '突撃')).toBe(true);
        break;
      case 'PR292':
      case 'PR298':
        expect(current().players.opp.scene.some(entry => entry.uid === 'low-remove-target')).toBe(true);
        resolvePick(row, 'sceneRemove', 'low-remove-target');
        expect(current().players.opp.remove).toContain(LOW_REMOVE_TARGET);
        expect(current().players.opp.scene.some(entry => entry.uid === 'high-remove-decoy')).toBe(true);
        expect(current().players.self.scene[0]?.state).toBe('sleep');
        break;
    }
    expect(current().players.opp.deck).toEqual([OPP_A, OPP_B, OPP_C, OPP_TAIL]);
    if (row.baseId !== 'B06020') expectSettled();
  });
});
