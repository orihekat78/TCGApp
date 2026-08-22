// qa: card:B04068:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
// qa: card:B05108:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// qa: card:D09016:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// qa: card:D09017:fe489ff3199dbdf91d8a4404721956da51ba17ccb819450ceed5b301f31fe7be
// qa: card:PR289:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:PR295:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// Rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
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

const PARTNER = 'D03001';
const TARGET = 'W40_TARGET';
const DRAW = 'W40_DRAW';
const NAGANO = 'D09008';

type Prompt = 'declare-optional' | 'declare-pick' | 'end-optional' | 'end-pick';
type Row = {
  cardId: 'B04068' | 'B05108' | 'D09016' | 'D09017' | 'PR289' | 'PR295';
  threshold: number;
  abilityId: 'a1' | 'a2';
  prompt: Prompt;
  baseAp: number;
  exactAp: number;
};

const ROWS: Row[] = [
  { cardId: 'B04068', threshold: 5, abilityId: 'a1', prompt: 'declare-optional', baseAp: 5000, exactAp: 5000 },
  { cardId: 'B05108', threshold: 6, abilityId: 'a2', prompt: 'end-optional', baseAp: 8000, exactAp: 8000 },
  { cardId: 'D09016', threshold: 6, abilityId: 'a1', prompt: 'declare-pick', baseAp: 4000, exactAp: 5000 },
  { cardId: 'D09017', threshold: 6, abilityId: 'a1', prompt: 'declare-pick', baseAp: 4000, exactAp: 5000 },
  { cardId: 'PR289', threshold: 7, abilityId: 'a1', prompt: 'end-pick', baseAp: 6000, exactAp: 6000 },
  { cardId: 'PR295', threshold: 7, abilityId: 'a1', prompt: 'end-pick', baseAp: 6000, exactAp: 6000 },
];

function fixtureCharacter(id: string, ap: number): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 1,
    ap, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function cardBacks(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function stateFor(row: Row, beforeCount: number, withStack = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.file = cardBacks(`${row.cardId}-SELF-FILE`, beforeCount);
  state.players.self.deck = [DRAW, 'B01001', 'B01002'];
  state.players.self.hand = row.prompt === 'declare-pick'
    ? [NAGANO]
    : row.prompt === 'end-pick'
      ? [DRAW]
      : [];
  state.players.self.scene = [sceneChar(row.cardId, 'source', {
    stackedCards: row.prompt === 'end-pick' && withStack ? 1 : 0,
  })];

  state.players.opp.partner = { cardId: PARTNER, state: 'sleep', location: 'file-area' };
  state.players.opp.file = [
    ...cardBacks(`${row.cardId}-OPP-FILE`, row.threshold - 1),
    { type: 'assisted-partner', cardId: PARTNER },
  ];
  state.players.opp.scene = [sceneChar(TARGET, 'target', { state: 'sleep' })];
  return state;
}

function install(row: Row, beforeCount: number, withStack = true): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-w40-${row.cardId}-${beforeCount}`);
  expect(useGameStateStore.getState().setGameState(stateFor(row, beforeCount, withStack))).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave40 state');
  return state;
}

function openDecisionKinds(): string[] {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  return [
    ['optional', store.pendingEffectOptional],
    ['pick', store.pendingEffectPick],
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
}

function resolvePrompt(row: Row): { kind: string | null; source: string | null } {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  if (row.prompt.endsWith('optional')) {
    const pending = store.pendingEffectOptional;
    if (!pending) return { kind: null, source: null };
    const source = pending.source.cardId;
    expect(pending.source).toMatchObject({ cardId: row.cardId, uid: 'source', abilityId: row.abilityId });
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
    return { kind: 'optional', source };
  }

  const pending = store.pendingEffectPick;
  if (!pending) return { kind: null, source: null };
  const source = pending.source.cardId;
  expect(pending.source).toMatchObject({ cardId: row.cardId, uid: 'source', abilityId: row.abilityId });
  const pickedUid = row.prompt === 'declare-pick'
    ? pending.candidates.find(candidate => candidate.cardId === NAGANO)?.uid ?? null
    : null;
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
  return { kind: 'pick', source };
}

function driveThroughActionEnd(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let step = 0; step < 3 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function run(row: Row, beforeCount: number, withStack = true) {
  install(row, beforeCount, withStack);
  const assist = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const declared = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }).ok;
  const actionId = useGameStateStore.getState().activeActionId!;

  let prompt = { kind: null as string | null, source: null as string | null };
  let guardBlocked: boolean | null = null;
  if (row.prompt.startsWith('declare')) {
    if (openDecisionKinds().length > 0) {
      guardBlocked = dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }).ok;
    }
    prompt = resolvePrompt(row);
  }

  driveThroughActionEnd(actionId);
  if (row.prompt.startsWith('end')) prompt = resolvePrompt(row);
  const state = current();
  return {
    assist,
    declared,
    fileCount: state.players.self.file.length,
    opponentFileCount: state.players.opp.file.length,
    selfAssistedEntries: state.players.self.file.filter(entry => entry.type === 'assisted-partner').length,
    promptKind: prompt.kind,
    promptSource: prompt.source,
    guardBlocked,
    sourceAp: readChar.ap(state, 'source'),
    sourceState: state.players.self.scene.find(character => character.uid === 'source')?.state,
    targetPresent: state.players.opp.scene.some(character => character.uid === 'target'),
    hand: [...state.players.self.hand],
    remove: [...state.players.self.remove],
    settled: openDecisionKinds().length === 0 && useGameStateStore.getState().activeActionId === null,
  };
}

function prove(row: Row) {
  return {
    cardId: row.cardId,
    below: run(row, row.threshold - 2),
    exact: run(row, row.threshold - 1),
    ...(row.prompt === 'end-pick'
      ? { exactWithoutStack: run(row, row.threshold - 1, false) }
      : {}),
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _resetActionContexts();
  resetPendingRuntimeState();
  registerAll();
  register(fixtureCharacter(TARGET, 9000));
  register(fixtureCharacter(DRAW, 1000));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetActionContexts();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave40: an assisting partner counts across the public action lifecycle', () => {
  it('B04068 enables its action-declare optional only at FILE5', () => {
    expect(prove(ROWS[0]!)).toEqual({
      cardId: 'B04068',
      below: { assist: true, declared: true, fileCount: 4, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 5000, sourceState: 'sleep', targetPresent: true, hand: [], remove: [], settled: true },
      exact: { assist: true, declared: true, fileCount: 5, opponentFileCount: 5, selfAssistedEntries: 1, promptKind: 'optional', promptSource: 'B04068', guardBlocked: false, sourceAp: 5000, sourceState: 'sleep', targetPresent: true, hand: [], remove: [], settled: true },
    });
  });

  it('B05108 enables its action-end optional only at FILE6', () => {
    expect(prove(ROWS[1]!)).toEqual({
      cardId: 'B05108',
      below: { assist: true, declared: true, fileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 8000, sourceState: 'sleep', targetPresent: true, hand: [], remove: [], settled: true },
      exact: { assist: true, declared: true, fileCount: 6, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: 'optional', promptSource: 'B05108', guardBlocked: null, sourceAp: 8000, sourceState: 'sleep', targetPresent: true, hand: [], remove: [], settled: true },
    });
  });

  it('D09016 enables its action-declare draw/discard only at FILE6', () => {
    expect(prove(ROWS[2]!)).toEqual({
      cardId: 'D09016',
      below: { assist: true, declared: true, fileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 4000, sourceState: 'sleep', targetPresent: true, hand: [NAGANO], remove: [], settled: true },
      exact: { assist: true, declared: true, fileCount: 6, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'D09016', guardBlocked: false, sourceAp: 5000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [NAGANO], settled: true },
    });
  });

  it('D09017 enables its action-declare draw/discard only at FILE6', () => {
    expect(prove(ROWS[3]!)).toEqual({
      cardId: 'D09017',
      below: { assist: true, declared: true, fileCount: 5, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 4000, sourceState: 'sleep', targetPresent: true, hand: [NAGANO], remove: [], settled: true },
      exact: { assist: true, declared: true, fileCount: 6, opponentFileCount: 6, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'D09017', guardBlocked: false, sourceAp: 5000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [NAGANO], settled: true },
    });
  });

  it('PR289 enables its stacked action-end discard picker only at FILE7', () => {
    expect(prove(ROWS[4]!)).toEqual({
      cardId: 'PR289',
      below: { assist: true, declared: true, fileCount: 6, opponentFileCount: 7, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 6000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [], settled: true },
      exact: { assist: true, declared: true, fileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'PR289', guardBlocked: null, sourceAp: 6000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [], settled: true },
      exactWithoutStack: { assist: true, declared: true, fileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 6000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [], settled: true },
    });
  });

  it('PR295 enables its stacked action-end discard picker only at FILE7', () => {
    expect(prove(ROWS[5]!)).toEqual({
      cardId: 'PR295',
      below: { assist: true, declared: true, fileCount: 6, opponentFileCount: 7, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 6000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [], settled: true },
      exact: { assist: true, declared: true, fileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, promptKind: 'pick', promptSource: 'PR295', guardBlocked: null, sourceAp: 6000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [], settled: true },
      exactWithoutStack: { assist: true, declared: true, fileCount: 7, opponentFileCount: 7, selfAssistedEntries: 1, promptKind: null, promptSource: null, guardBlocked: null, sourceAp: 6000, sourceState: 'sleep', targetPresent: true, hand: [DRAW], remove: [], settled: true },
    });
  });
});
