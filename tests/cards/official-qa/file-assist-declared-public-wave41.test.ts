// qa: card:B08056:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// qa: card:B09010:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// qa: card:B09036:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// qa: card:B10095:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// qa: card:D10011:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// Rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
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

const BLUE_PARTNER = 'D08001';
const MIYANO = 'W41_MIYANO';
const RAN = 'W41_RAN';
const DECOY = 'W41_DECOY';

type Row = {
  cardId: 'B08056' | 'B09010' | 'B09036' | 'B10095' | 'D10011';
  threshold: number;
  abilityId: 'a1' | 'a2';
  abilityIndex: number;
  target: string | null;
};

const ROWS: Row[] = [
  { cardId: 'B08056', threshold: 5, abilityId: 'a1', abilityIndex: 0, target: MIYANO },
  { cardId: 'B09010', threshold: 6, abilityId: 'a1', abilityIndex: 0, target: null },
  { cardId: 'B09036', threshold: 5, abilityId: 'a2', abilityIndex: 1, target: null },
  { cardId: 'B10095', threshold: 5, abilityId: 'a2', abilityIndex: 1, target: RAN },
  { cardId: 'D10011', threshold: 6, abilityId: 'a1', abilityIndex: 0, target: RAN },
];

function fixtureCharacter(
  id: string,
  names: string[],
  level: number,
  options: Partial<CardDef> = {},
): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: ['青'], level,
    ap: 3000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

function cardBacks(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function stateFor(row: Row, beforeCount: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: BLUE_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.case.status = '解決編';
  state.players.self.file = cardBacks(`${row.cardId}-SELF-FILE`, beforeCount);
  state.players.self.deck = ['B01001', 'B01002'];
  state.players.self.scene = [sceneChar(row.cardId, 'source')];

  if (row.cardId === 'B08056') state.players.self.hand = [MIYANO, DECOY];
  if (row.cardId === 'B09010') state.players.self.remove = [DECOY];
  if (row.cardId === 'B09036') state.players.self.scene.push(sceneChar('B09036', 'same-name'));
  if (row.cardId === 'B10095' || row.cardId === 'D10011') state.players.self.remove = [RAN, DECOY];

  state.players.opp.partner = { cardId: BLUE_PARTNER, state: 'sleep', location: 'file-area' };
  state.players.opp.file = [
    ...cardBacks(`${row.cardId}-OPP-FILE`, row.threshold - 1),
    { type: 'assisted-partner', cardId: BLUE_PARTNER },
  ];
  return state;
}

function install(row: Row, beforeCount: number): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-w41-${row.cardId}-${beforeCount}`);
  expect(useGameStateStore.getState().setGameState(stateFor(row, beforeCount))).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave41 state');
  return state;
}

function sourceArea(state: GameState, cardId: string): 'scene' | 'remove' | 'deck' | 'missing' {
  if (state.players.self.scene.some(character => character.uid === 'source')) return 'scene';
  if (state.players.self.remove.includes(cardId)) return 'remove';
  if (state.players.self.deck.includes(cardId)) return 'deck';
  return 'missing';
}

function resolvePick(row: Row): { kind: 'pick' | null; source: string | null } {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  if (!pending) return { kind: null, source: null };
  expect(pending.source).toMatchObject({ cardId: row.cardId, uid: 'source', abilityId: row.abilityId });
  const pickedUid = row.target === null
    ? null
    : pending.candidates.find(candidate => candidate.cardId === row.target)?.uid ?? null;
  if (row.target !== null) expect(pickedUid, `${row.cardId}: eligible continuation`).not.toBeNull();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
  return { kind: 'pick', source: pending.source.cardId };
}

function run(row: Row, beforeCount: number) {
  install(row, beforeCount);
  const assist = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const declared = dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: row.abilityId,
  }).ok;
  const prompt = resolvePick(row);
  const state = current();
  const entered = row.target === null
    ? false
    : state.players.self.scene.some(character => character.cardId === row.target);
  const enteredUid = row.target === null
    ? undefined
    : state.players.self.scene.find(character => character.cardId === row.target)?.uid;
  return {
    assist,
    declared,
    fileCount: state.players.self.file.length,
    opponentFileCount: state.players.opp.file.length,
    selfAssistedEntries: state.players.self.file.filter(entry => entry.type === 'assisted-partner').length,
    promptKind: prompt.kind,
    promptSource: prompt.source,
    sourceArea: sourceArea(state, row.cardId),
    sourceAtDeckBottom: state.players.self.deck.at(-1) === row.cardId,
    sourceState: state.players.self.scene.find(character => character.uid === 'source')?.state ?? null,
    sourceUseCount: state.players.self.scene.some(character => character.uid === 'source')
      ? readChar.declaredUseCount(state, 'source', row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      })
      : null,
    entered,
    enteredAp: enteredUid ? readChar.ap(state, enteredUid) : null,
    targetInHand: row.target !== null && state.players.self.hand.includes(row.target),
    targetInRemove: row.target !== null && state.players.self.remove.includes(row.target),
    removedFileCards: state.players.self.remove.filter(cardId => cardId.startsWith(`${row.cardId}-SELF-FILE`)).length,
    settled: useGameStateStore.getState().pendingEffectPick === null,
  };
}

function prove(row: Row) {
  return {
    cardId: row.cardId,
    below: run(row, row.threshold - 2),
    exact: run(row, row.threshold - 1),
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  register(fixtureCharacter(MIYANO, ['宮野エレーナ'], 7, { colors: ['赤'] }));
  register(fixtureCharacter(RAN, ['毛利蘭'], 5));
  register(fixtureCharacter(DECOY, ['対象外'], 3));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave41: an assisting partner counts for public declared FILE conditions', () => {
  it('B08056 enables its named hand-entry declaration only at FILE5', () => {
    expect(prove(ROWS[0]!)).toEqual({
      cardId: 'B08056',
      below: { assist: true, declared: false, fileCount: 4, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: null, promptSource: null, sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'active', sourceUseCount: 0, entered: false, enteredAp: null, targetInHand: true, targetInRemove: false, removedFileCards: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'B08056', sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'sleep', sourceUseCount: 1, entered: true, enteredAp: 3000, targetInHand: false, targetInRemove: false, removedFileCards: 0, settled: true },
    });
  });

  it('B09010 enables its declaration at FILE6 and removes a non-partner FILE card', () => {
    expect(prove(ROWS[1]!)).toEqual({
      cardId: 'B09010',
      below: { assist: true, declared: false, fileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: null, promptSource: null, sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'active', sourceUseCount: 0, entered: false, enteredAp: null, targetInHand: false, targetInRemove: false, removedFileCards: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: null, promptSource: null, sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'sleep', sourceUseCount: 1, entered: false, enteredAp: null, targetInHand: false, targetInRemove: false, removedFileCards: 1, settled: true },
    });
  });

  it('B09036 enables its same-name declaration only at FILE5', () => {
    expect(prove(ROWS[2]!)).toEqual({
      cardId: 'B09036',
      below: { assist: true, declared: false, fileCount: 4, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: null, promptSource: null, sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'active', sourceUseCount: 0, entered: false, enteredAp: null, targetInHand: false, targetInRemove: false, removedFileCards: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'B09036', sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'active', sourceUseCount: 1, entered: false, enteredAp: null, targetInHand: false, targetInRemove: false, removedFileCards: 0, settled: true },
    });
  });

  it('B10095 enables its paid remove-area entry only at FILE5', () => {
    expect(prove(ROWS[3]!)).toEqual({
      cardId: 'B10095',
      below: { assist: true, declared: false, fileCount: 4, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: null, promptSource: null, sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'active', sourceUseCount: 0, entered: false, enteredAp: null, targetInHand: false, targetInRemove: true, removedFileCards: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'B10095', sourceArea: 'remove', sourceAtDeckBottom: false, sourceState: null, sourceUseCount: null, entered: true, enteredAp: 4000, targetInHand: false, targetInRemove: false, removedFileCards: 0, settled: true },
    });
  });

  it('D10011 enables its deck-bottom cost and remove-area entry only at FILE6', () => {
    expect(prove(ROWS[4]!)).toEqual({
      cardId: 'D10011',
      below: { assist: true, declared: false, fileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: null, promptSource: null, sourceArea: 'scene', sourceAtDeckBottom: false, sourceState: 'active', sourceUseCount: 0, entered: false, enteredAp: null, targetInHand: false, targetInRemove: true, removedFileCards: 0, settled: true },
      exact: { assist: true, declared: true, fileCount: 6, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'D10011', sourceArea: 'deck', sourceAtDeckBottom: true, sourceState: null, sourceUseCount: null, entered: true, enteredAp: 3000, targetInHand: false, targetInRemove: false, removedFileCards: 0, settled: true },
    });
  });
});
