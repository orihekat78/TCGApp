// qa: card:B07020:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:B07032:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:B07063:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:B07074:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:B07088:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:D10007:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:D10008:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// Rules: 03-field-areas, 15-abilities-effects, 21-declared-ability-cost.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B07020' | 'B07032' | 'B07063' | 'B07074' | 'B07088' | 'D10007' | 'D10008';
type Row = {
  cardId: string;
  baseId: BaseId;
  abilityId: 'a1' | 'a2';
  abilityIndex: 0 | 1;
  sleeps: boolean;
  limited: boolean;
};

const PRINTINGS: Row[] = [
  { cardId: 'B07020', baseId: 'B07020', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
  { cardId: 'B07020P', baseId: 'B07020', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
  { cardId: 'B07032', baseId: 'B07032', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
  { cardId: 'B07032P', baseId: 'B07032', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
  { cardId: 'B07063', baseId: 'B07063', abilityId: 'a2', abilityIndex: 1, sleeps: true, limited: true },
  { cardId: 'B07063P', baseId: 'B07063', abilityId: 'a2', abilityIndex: 1, sleeps: true, limited: true },
  { cardId: 'B07074', baseId: 'B07074', abilityId: 'a2', abilityIndex: 1, sleeps: false, limited: false },
  { cardId: 'B07088', baseId: 'B07088', abilityId: 'a2', abilityIndex: 1, sleeps: true, limited: false },
  { cardId: 'D10007', baseId: 'D10007', abilityId: 'a2', abilityIndex: 1, sleeps: false, limited: true },
  { cardId: 'D10008', baseId: 'D10008', abilityId: 'a2', abilityIndex: 1, sleeps: false, limited: true },
];

const BASE_ROWS = PRINTINGS.filter(row => row.cardId === row.baseId);
const SLEEP_ROWS = PRINTINGS.filter(row => row.sleeps);
const SOURCE_UID = 'wave58-source';
const PARTNER = 'W58-PARTNER';
const OWN_KEEP = 'W58-OWN-KEEP';
const OWN_COST = 'W58-OWN-COST';
const OPP_A = 'W58-OPP-A';
const OPP_B = 'W58-OPP-B';
const POLICE_ENTRY = 'W58-POLICE-ENTRY';
const LOW_TARGET = 'W58-LOW-TARGET';
const HIGH_TARGET = 'W58-HIGH-TARGET';
const HIGH_SCHOOL_ZERO = 'W58-HIGH-SCHOOL-ZERO';
const AP_TARGET = 'W58-AP-TARGET';
const POLICE_RETURN = 'W58-POLICE-RETURN';
const DRAW_A = 'W58-DRAW-A';
const DRAW_B = 'W58-DRAW-B';

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
  fixture(OWN_KEEP, { kind: 'event' }), fixture(OWN_COST, { kind: 'event' }),
  fixture(OPP_A, { kind: 'event' }), fixture(OPP_B, { kind: 'event' }),
  fixture(POLICE_ENTRY, { level: 4, traits: ['警察'] }),
  fixture(LOW_TARGET, { ap: 7000 }), fixture(HIGH_TARGET, { ap: 9000 }),
  fixture(HIGH_SCHOOL_ZERO, { lp: 0, ap: 3000, traits: ['高校生'] }),
  fixture(AP_TARGET, { ap: 3000 }), fixture(POLICE_RETURN, { traits: ['警察'] }),
  fixture(DRAW_A), fixture(DRAW_B),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave58 state');
  return state;
}

function baseState(row: Row, owner: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].scene = [sceneChar(row.cardId, SOURCE_UID, { state: 'active' })];
  state.players[owner].deck = [DRAW_A, DRAW_B];
  state.players.self.hand = [];
  state.players.opp.hand = [];
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

function dispatch(row: Row, indices: number[], extra: Record<string, unknown> = {}) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: SOURCE_UID, abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
    costParams: { removeFromHand: { indices }, ...extra },
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

function resolvePick(row: Row, verb: string, target: { uid?: string; cardId?: string }): void {
  const pick = pendingPick(row, verb);
  const candidate = pick.candidates.find(entry => (
    (target.uid !== undefined && entry.uid === target.uid)
    || (target.cardId !== undefined && entry.cardId === target.cardId)
  ));
  expect(candidate, `${row.cardId}: effect target`).toBeDefined();
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function decisionKinds(): string[] {
  const store = useGameStateStore.getState();
  return [
    ['pick', store.pendingEffectPick], ['choice', store.pendingEffectChoice],
    ['optional', store.pendingEffectOptional], ['repeat', store.pendingEffectRepeatOptional],
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

describe('official QA Wave58: a declared hand-removal cost uses only its owner hand', () => {
  // Card-bound physical rows: B07020/P B07032/P B07063/P B07074 B07088 D10007 D10008.
  it.each(PRINTINGS)('$cardId pays exact one from its own hand and never the opponent hand', row => {
    const state = baseState(row);
    state.players.self.hand = [OWN_KEEP, OWN_COST];
    state.players.opp.hand = [OPP_A, OPP_B];
    const opponentHand = [...state.players.opp.hand];
    install(state, `${row.cardId}:wave58-positive`);

    expect(dispatch(row, [1]), `${row.cardId}: own hand payment accepted`).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.cardId, `${row.cardId}: physical source retained`).toBe(row.cardId);
    expect(current().players.self.hand, `${row.cardId}: only chosen own occurrence leaves`).toEqual([OWN_KEEP]);
    expect(current().players.self.remove, `${row.cardId}: chosen own occurrence reaches remove`).toEqual([OWN_COST]);
    expect(current().players.opp.hand, `${row.cardId}: opponent hidden hand isolated`).toEqual(opponentHand);
    expect(current().players.opp.remove, `${row.cardId}: opponent remove isolated`).toEqual([]);
    expect(current().players.self.scene[0]?.state, `${row.cardId}: compound sleep cost`).toBe(row.sleeps ? 'sleep' : 'active');
    if (row.limited) {
      expect(readChar.declaredUseCount(current(), SOURCE_UID, row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      }), `${row.cardId}: exact occurrence consumes turn use`).toBe(1);
    }
  });

  it.each(BASE_ROWS)('$cardId rejects opponent-shaped and malformed hand selections transactionally', row => {
    const attempts = [
      { label: 'empty-own', own: [] as string[], indices: [0] },
      { label: 'zero-selected', own: [OWN_COST], indices: [] as number[] },
      { label: 'opponent-shaped-index', own: [OWN_COST], indices: [1] },
      { label: 'overspecified', own: [OWN_KEEP, OWN_COST], indices: [0, 1] },
      { label: 'duplicate', own: [OWN_KEEP, OWN_COST], indices: [0, 0] },
    ];
    for (const attempt of attempts) {
      const state = baseState(row);
      state.players.self.hand = [...attempt.own];
      state.players.opp.hand = [OPP_A, OPP_B];
      install(state, `${row.cardId}:wave58-${attempt.label}`);
      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(dispatch(row, attempt.indices), `${row.cardId}: ${attempt.label} rejects`)
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(current(), `${row.cardId}: ${attempt.label} preserves reference`).toBe(before);
      expect(JSON.stringify(current()), `${row.cardId}: ${attempt.label} preserves semantics`).toBe(beforeJson);
      expect(decisionKinds(), `${row.cardId}: ${attempt.label} opens no decision`).toEqual([]);
      expect(current().pendingRuntimeState, `${row.cardId}: ${attempt.label} opens no runtime`).toBeUndefined();
    }
  });

  it.each(SLEEP_ROWS)('$cardId rejects a valid hand leaf when sleepSelf is unavailable', row => {
    const state = baseState(row);
    state.players.self.scene[0]!.state = 'sleep';
    state.players.self.hand = [OWN_COST];
    state.players.opp.hand = [OPP_A];
    install(state, `${row.cardId}:wave58-sleep-unavailable`);
    const before = current();
    const beforeJson = JSON.stringify(before);
    expect(dispatch(row, [0])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
  });

  it('resolves self relative to an opponent-owned physical D10007 source', () => {
    const row = PRINTINGS.find(entry => entry.cardId === 'D10007')!;
    const state = baseState(row, 'opp');
    state.players.self.hand = [OWN_KEEP];
    state.players.opp.hand = [OPP_A];
    install(state, 'D10007:wave58-owner-relative', 'opp');

    expect(dispatch(row, [0])).toEqual({ ok: true });
    expect(current().players.opp.hand).toEqual([]);
    expect(current().players.opp.remove).toEqual([OPP_A]);
    expect(current().players.self.hand).toEqual([OWN_KEEP]);
    expect(current().players.self.remove).toEqual([]);
    expect(readChar.ap(current(), SOURCE_UID)).toBe(7000);
    expect(readChar.hasKeyword(current(), SOURCE_UID, '突撃')).toBe(true);
  });

  it.each(BASE_ROWS)('$cardId reaches its printed effect after the same own-hand payment', row => {
    const state = baseState(row);
    state.players.self.hand = [OWN_COST];
    switch (row.baseId) {
      case 'B07020': state.players.self.hand = [POLICE_ENTRY]; break;
      case 'B07032': state.players.opp.scene = [
        sceneChar(LOW_TARGET, 'low-target'), sceneChar(HIGH_TARGET, 'high-decoy'),
      ]; break;
      case 'B07063': state.players.opp.scene = [sceneChar(HIGH_SCHOOL_ZERO, 'high-school-zero', { state: 'sleep' })]; break;
      case 'B07074': state.players.opp.scene = [sceneChar(AP_TARGET, 'ap-target')]; break;
      case 'B07088': state.players.self.remove = [POLICE_RETURN]; break;
      default: break;
    }
    install(state, `${row.cardId}:wave58-effect-sentinel`);
    const extra = row.baseId === 'B07074' ? { choiceIndex: 0 } : {};
    expect(dispatch(row, [0], extra)).toEqual({ ok: true });

    switch (row.baseId) {
      case 'B07020':
        resolvePick(row, 'sceneEnter', { cardId: POLICE_ENTRY });
        expect(current().players.self.scene.some(entry => entry.cardId === POLICE_ENTRY)).toBe(true);
        break;
      case 'B07032': {
        resolvePick(row, 'sceneRemove', { uid: 'low-target' });
        surfacePendingSideChannels();
        const optional = useGameStateStore.getState().pendingEffectOptional;
        expect(optional?.source).toMatchObject(sourceOf(row));
        expect(dispatchEngineAction(bindPendingDecision(optional!, {
          type: 'optionalResolve', run: false,
        }))).toEqual({ ok: true });
        expect(current().players.opp.remove).toContain(LOW_TARGET);
        expect(current().players.opp.scene.some(entry => entry.uid === 'high-decoy')).toBe(true);
        break;
      }
      case 'B07063':
        resolvePick(row, 'charModifyAP', { uid: 'high-school-zero' });
        expect(current().players.opp.scene[0]?.state).toBe('active');
        expect(readChar.ap(current(), 'high-school-zero')).toBe(4000);
        break;
      case 'B07074':
        resolvePick(row, 'charModifyAP', { uid: 'ap-target' });
        expect(readChar.ap(current(), 'ap-target')).toBe(4000);
        break;
      case 'B07088':
        resolvePick(row, 'handAddFromRemove', { cardId: POLICE_RETURN });
        expect(current().players.self.hand).toContain(POLICE_RETURN);
        expect(current().players.self.remove).toContain(OWN_COST);
        break;
      case 'D10007':
      case 'D10008':
        expect(readChar.ap(current(), SOURCE_UID)).toBe(7000);
        expect(readChar.hasKeyword(current(), SOURCE_UID, '突撃')).toBe(true);
        expect(current().players.self.remove).toContain(OWN_COST);
        break;
    }
    expectSettled();
  });
});
