// qa: card:B07062:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B08076:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B08094:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B10034:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B10082:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B10101:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:B10102:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
// qa: card:D10026:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
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
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B07062' | 'B08076' | 'B08094' | 'B10034' | 'B10082' | 'B10101' | 'B10102' | 'D10026';
type Row = { cardId: string; baseId: BaseId };

const PRINTINGS: Row[] = [
  { cardId: 'B07062', baseId: 'B07062' },
  { cardId: 'B07062P', baseId: 'B07062' },
  { cardId: 'B08076', baseId: 'B08076' },
  { cardId: 'B08076P', baseId: 'B08076' },
  { cardId: 'B08094', baseId: 'B08094' },
  { cardId: 'B08094P', baseId: 'B08094' },
  { cardId: 'B10034', baseId: 'B10034' },
  { cardId: 'B10034P', baseId: 'B10034' },
  { cardId: 'B10082', baseId: 'B10082' },
  { cardId: 'B10082P', baseId: 'B10082' },
  { cardId: 'B10101', baseId: 'B10101' },
  { cardId: 'B10101P', baseId: 'B10101' },
  { cardId: 'B10102', baseId: 'B10102' },
  { cardId: 'B10102P', baseId: 'B10102' },
  { cardId: 'D10026', baseId: 'D10026' },
];

const BASE_ROWS = PRINTINGS.filter(row => row.cardId === row.baseId);

const KOIZUMI = 'W57_KOIZUMI';
const SATO = 'W57_SATO';
const TAKAGI = 'W57_TAKAGI';
const HAIBARA = 'W57_HAIBARA';
const POLICE_A = 'W57_POLICE_A';
const POLICE_B = 'W57_POLICE_B';
const FURUYA = 'W57_FURUYA';
const RED_MAGIC_EVENT = 'W57_RED_MAGIC_EVENT';
const OTHER_EVENT = 'W57_OTHER_EVENT';
const SATO_ENTRY = 'W57-SATO-ENTRY';
const LEAVE_TARGET = 'W57_LEAVE_TARGET';
const FURUYA_DRAW = 'W57_FURUYA_DRAW';
const GREEN_GIVER = 'W57_GREEN_GIVER';
const VANILLA_A = 'W57_VANILLA_A';
const VANILLA_B = 'W57_VANILLA_B';
const DRAW = 'W57_DRAW';
const DECK_DECOY = 'W57_DECK_DECOY';
const DECK_TAIL = 'W57_DECK_TAIL';
const LOOK_A = 'W57_LOOK_A';
const LOOK_B = 'W57_LOOK_B';
const ROMANCE_EVENT = 'W57_ROMANCE_EVENT';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'], traits: [],
    level: 3, ap: 3000, lp: 1, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const fixtures: CardDef[] = [
  character(KOIZUMI, { names: ['小泉紅子'] }),
  character(SATO, { names: ['佐藤美和子'], colors: ['黄'] }),
  character(TAKAGI, { names: ['高木渉'], colors: ['黄'] }),
  character(HAIBARA, { names: ['灰原哀'] }),
  character(POLICE_A, { colors: ['緑'], traits: ['警察'] }),
  character(POLICE_B, { colors: ['緑'], traits: ['警察'] }),
  character(FURUYA, { names: ['降谷零'], colors: ['黄'] }),
  character(RED_MAGIC_EVENT, { kind: 'event', traits: ['赤魔術'] }),
  character(OTHER_EVENT, { kind: 'event', names: ['別イベント'] }),
  character(SATO_ENTRY, { names: ['佐藤美和子'], colors: ['黄'], level: 4 }),
  character(LEAVE_TARGET, { keywords: ['現場リムーブ時'] }),
  character(FURUYA_DRAW, { names: ['降谷零'], colors: ['黄'] }),
  character(GREEN_GIVER, { colors: ['緑'] }),
  character(VANILLA_A),
  character(VANILLA_B),
  character(DRAW),
  character(DECK_DECOY),
  character(DECK_TAIL),
  character(LOOK_A),
  character(LOOK_B),
  character(ROMANCE_EVENT, { kind: 'event', names: ['シャッフルロマンス'] }),
];

function setupCondition(row: Row, state: GameState): void {
  switch (row.baseId) {
    case 'B07062':
      state.players.self.scene = [sceneChar(KOIZUMI, 'koizumi')];
      break;
    case 'B08076':
      state.players.self.scene = [sceneChar(SATO, 'sato-cost'), sceneChar(TAKAGI, 'takagi-keep')];
      break;
    case 'B08094':
      state.players.self.scene = [sceneChar(HAIBARA, 'haibara')];
      break;
    case 'B10034':
      state.players.self.scene = [sceneChar(POLICE_A, 'police-a'), sceneChar(POLICE_B, 'police-b')];
      break;
    case 'B10082':
      state.players.self.scene = [sceneChar(FURUYA, 'furuya')];
      break;
    default:
      state.players.self.scene = [];
  }
}

function baseState(row: Row): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = {
    ...state.players.self.case,
    cardId: row.cardId,
    status: '解決編',
    declaredUseCount: {},
  };
  state.players.self.evidence = [
    { cardId: 'W57_SELF_A', faceUp: false, origin: { turn: 1, via: 'opening' as const } },
    { cardId: 'W57_SELF_B', faceUp: true, origin: { turn: 2, via: 'reasoning' as const } },
    { cardId: 'W57_SELF_C', faceUp: false, origin: { turn: 3, via: 'effect' as const } },
    { cardId: 'W57_SELF_D', faceUp: false, origin: { turn: 4, via: 'reasoning' as const } },
  ];
  state.players.opp.evidence = [
    { cardId: 'W57_OPP_A', faceUp: false, origin: { turn: 1, via: 'opening' as const } },
    { cardId: 'W57_OPP_B', faceUp: true, origin: { turn: 2, via: 'effect' as const } },
  ];
  state.players.self.hand = [];
  state.players.self.deck = [];
  state.players.self.remove = [];
  setupCondition(row, state);
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave57 state');
  return state;
}

function costParams(row: Row, indices: number[]) {
  return {
    flipFaceUpEvidence: { indices },
    ...(row.baseId === 'B08076' ? { sceneToDeckBottom: { uids: ['sato-cost'] } } : {}),
    ...(row.baseId === 'D10026' ? { choiceIndex: 0 } : {}),
  };
}

function dispatch(row: Row, indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'case:self',
    abilId: 'a2',
    abilityOrigin: 'printed',
    abilityIndex: 1,
    costParams: costParams(row, indices),
  });
}

function decisionKinds(): string[] {
  const store = useGameStateStore.getState();
  return [
    ['choice', store.pendingEffectChoice],
    ['optional', store.pendingEffectOptional],
    ['pick', store.pendingEffectPick],
    ['deck-place', store.pendingDeckPlace],
    ['deck-reorder', store.pendingDeckReorder],
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
}

function pendingPick(expectedVerb: string, cardId: string) {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb, `${cardId}: effect pick verb`).toBe(expectedVerb);
  expect(pick?.source, `${cardId}: physical case source authority`).toMatchObject({
    cardId, uid: 'case:self', abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
  });
  return pick!;
}

function resolveCardPick(expectedVerb: string, sourceCardId: string, targetCardId: string): void {
  const pick = pendingPick(expectedVerb, sourceCardId);
  const candidate = pick.candidates.find(entry => entry.cardId === targetCardId);
  expect(candidate, `${sourceCardId}: ${targetCardId} candidate`).toBeDefined();
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function effectState(row: Row): GameState {
  const state = baseState(row);
  switch (row.baseId) {
    case 'B07062':
      state.players.self.remove = [RED_MAGIC_EVENT, OTHER_EVENT];
      break;
    case 'B08076':
      state.players.self.remove = [SATO_ENTRY];
      break;
    case 'B08094':
      state.players.self.deck = [LEAVE_TARGET, DECK_DECOY, DECK_TAIL];
      break;
    case 'B10034':
      state.players.self.deck = [DRAW];
      break;
    case 'B10082':
      state.players.self.deck = [FURUYA_DRAW, DECK_DECOY, DECK_TAIL];
      break;
    case 'B10101':
      state.players.self.scene = [sceneChar(GREEN_GIVER, 'green-giver')];
      break;
    case 'B10102':
      state.players.self.scene = [sceneChar(VANILLA_A, 'vanilla-a'), sceneChar(VANILLA_B, 'vanilla-b')];
      state.players.self.deck = [LOOK_A, LOOK_B, DECK_TAIL];
      break;
    case 'D10026':
      state.players.self.remove = [ROMANCE_EVENT, OTHER_EVENT];
      break;
  }
  return state;
}

function assertCardEffect(row: Row): void {
  switch (row.baseId) {
    case 'B07062':
      resolveCardPick('handAddFromRemove', row.cardId, RED_MAGIC_EVENT);
      expect(current().players.self.hand).toContain(RED_MAGIC_EVENT);
      expect(current().players.self.remove).toContain(OTHER_EVENT);
      break;
    case 'B08076': {
      resolveCardPick('sceneEnter', row.cardId, SATO_ENTRY);
      const entered = current().players.self.scene.find(entry => entry.cardId === SATO_ENTRY);
      expect(entered?.state, `${row.cardId}: selected entry is sleeping`).toBe('sleep');
      expect(current().players.self.scene.some(entry => entry.uid === 'sato-cost')).toBe(false);
      expect(current().players.self.deck.at(-1)).toBe(SATO);
      break;
    }
    case 'B08094':
      resolveCardPick('deckRevealUntil', row.cardId, LEAVE_TARGET);
      expect(current().players.self.hand).toContain(LEAVE_TARGET);
      expect(current().players.self.deck).toEqual([DECK_DECOY, DECK_TAIL]);
      break;
    case 'B10034':
      expect(current().players.self.hand, `${row.cardId}: draw effect resolves`).toEqual([DRAW]);
      break;
    case 'B10082':
      resolveCardPick('deckRevealUntil', row.cardId, FURUYA_DRAW);
      expect(current().players.self.hand).toContain(FURUYA_DRAW);
      expect(current().players.self.remove).toContain(DECK_DECOY);
      expect(current().players.self.deck).toEqual([DECK_TAIL]);
      break;
    case 'B10101':
      resolveCardPick('charGrantAbility', row.cardId, GREEN_GIVER);
      expect(current().players.self.scene[0]?.turnEffects.grantedAbilities).toEqual([
        expect.objectContaining({ id: 'b10101-granted-assault-search' }),
      ]);
      break;
    case 'B10102':
      resolveCardPick('deckRevealUntil', row.cardId, LOOK_A);
      resolveCardPick('deckRevealUntil', row.cardId, LOOK_B);
      expect(current().players.self.hand).toEqual([LOOK_A, LOOK_B]);
      expect(current().players.self.deck).toEqual([DECK_TAIL]);
      break;
    case 'D10026':
      resolveCardPick('handAddFromRemove', row.cardId, ROMANCE_EVENT);
      expect(current().players.self.hand).toContain(ROMANCE_EVENT);
      expect(current().players.self.remove).toContain(OTHER_EVENT);
      break;
  }
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
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});
describe('official QA Wave57: exact-two cost may choose arbitrary evidence positions without reordering', () => {
  // Card-bound physical rows: B07062/P B08076/P B08094/P B10034/P B10082/P B10101/P B10102/P D10026.
  it.each(PRINTINGS)('$cardId accepts non-sorted nonadjacent indices [3,0] on its physical printing', row => {
    const state = baseState(row);
    const selfIdentity = state.players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin }));
    const opponentSnapshot = JSON.parse(JSON.stringify(state.players.opp.evidence));
    install(state, `${row.cardId}:wave57-position-positive`);

    expect(dispatch(row, [3, 0]), `${row.cardId}: arbitrary positions accepted`).toEqual({ ok: true });
    expect(current().players.self.case.cardId, `${row.cardId}: physical case source retained`).toBe(row.cardId);
    expect(current().players.self.evidence.map(({ cardId, origin }) => ({ cardId, origin })),
      `${row.cardId}: evidence identity/origin/order retained`).toEqual(selfIdentity);
    expect(current().players.self.evidence.map(entry => entry.faceUp),
      `${row.cardId}: only indices 3 and 0 flip`).toEqual([true, true, false, true]);
    expect(current().players.opp.evidence, `${row.cardId}: opponent evidence isolated`).toEqual(opponentSnapshot);
    expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    }), `${row.cardId}: exact physical occurrence consumes turn use`).toBe(1);
  });

  it.each(BASE_ROWS)('$cardId rejects malformed selections transactionally before any effect', row => {
    const invalid = [
      { label: 'one', indices: [0] },
      { label: 'three', indices: [0, 2, 3] },
      { label: 'duplicate', indices: [0, 0] },
      { label: 'out-of-range', indices: [0, 9] },
      { label: 'already-face-up', indices: [0, 1] },
    ];

    for (const attempt of invalid) {
      install(baseState(row), `${row.cardId}:wave57-${attempt.label}`);
      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(dispatch(row, attempt.indices), `${row.cardId}: ${attempt.label} rejects`)
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(current(), `${row.cardId}: ${attempt.label} keeps state reference`).toBe(before);
      expect(JSON.stringify(current()), `${row.cardId}: ${attempt.label} keeps state semantics`).toBe(beforeJson);
      expect(decisionKinds(), `${row.cardId}: ${attempt.label} opens no decision`).toEqual([]);
      expect(current().pendingRuntimeState, `${row.cardId}: ${attempt.label} opens no runtime`).toBeUndefined();
      expect(readChar.declaredUseCount(current(), 'case:self', 'a2', {
        abilityOrigin: 'printed', abilityIndex: 1,
      }), `${row.cardId}: ${attempt.label} consumes no turn use`).toBe(0);
    }
  });

  it.each(BASE_ROWS)('$cardId reaches its card-specific effect from the same [3,0] payment', row => {
    install(effectState(row), `${row.cardId}:wave57-effect-sentinel`);
    expect(dispatch(row, [3, 0])).toEqual({ ok: true });
    expect(current().players.self.evidence.map(entry => entry.faceUp)).toEqual([true, true, false, true]);
    assertCardEffect(row);
  });
});
