// qa: card:B04023:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:D09014:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:D09015:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:PR137:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:PR143:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// Rules: 01-victory-conditions.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const WHITE_PARTNER = 'D03001';
const TARGET = 'D09008';
const THRESHOLD = 7;
const CASE_COLOR: Record<string, string> = {
  B04023: '緑',
  D09014: '黄',
  D09015: '黄',
  PR137: '白',
  PR143: '白',
};

type SimpleRow = {
  cardId: 'B04023' | 'D09014' | 'D09015';
  pending: 'optional' | 'pick';
};

const SIMPLE_ROWS: SimpleRow[] = [
  { cardId: 'B04023', pending: 'optional' },
  { cardId: 'D09014', pending: 'pick' },
  { cardId: 'D09015', pending: 'pick' },
];

const CHOICE_CARDS = ['PR137', 'PR143'] as const;

function cardBacks(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function stateFor(cardId: string, selfCardBacks: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [CASE_COLOR[cardId]!];
  state.players.self.partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.file = cardBacks(`${cardId}-SELF-FILE`, selfCardBacks);
  state.players.self.hand = [cardId];
  state.players.self.deck = ['B01001', 'B01002', 'B01003', 'B01004'];
  state.players.opp.scene = [sceneChar(TARGET, `${cardId}-target`, { state: 'active' })];

  // Opponent already satisfies FILE7. The self ability must remain owner-relative below threshold.
  state.players.opp.partner = { cardId: WHITE_PARTNER, state: 'sleep', location: 'file-area' };
  state.players.opp.file = [
    ...cardBacks(`${cardId}-OPP-FILE`, THRESHOLD - 1),
    { type: 'assisted-partner', cardId: WHITE_PARTNER },
  ];
  return state;
}

function install(state: GameState): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave39 state');
  return state;
}

function openDecisionKinds(): string[] {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  return [
    ['choice', store.pendingEffectChoice],
    ['optional', store.pendingEffectOptional],
    ['pick', store.pendingEffectPick],
  ].filter(entry => Boolean(entry[1])).map(entry => entry[0] as string);
}

function prepareEntry(cardId: string, beforeCount: number) {
  install(stateFor(cardId, beforeCount));
  const assist = dispatchEngineAction({ type: 'assist', player: 'self' }).ok;
  const handUse = dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId }).ok;
  surfacePendingSideChannels();
  return { assist, handUse };
}

function resolveSimplePending(kind: SimpleRow['pending']): { source: string | null; settled: boolean } {
  const store = useGameStateStore.getState();
  if (kind === 'optional') {
    const pending = store.pendingEffectOptional;
    const source = pending?.source.cardId ?? null;
    if (pending) {
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'optionalResolve', run: false,
      }))).toEqual({ ok: true });
    }
    return { source, settled: openDecisionKinds().length === 0 };
  }
  const pending = store.pendingEffectPick;
  const source = pending?.source.cardId ?? null;
  if (pending) {
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
  }
  return { source, settled: openDecisionKinds().length === 0 };
}

function runSimple(row: SimpleRow, beforeCount: number) {
  const dispatch = prepareEntry(row.cardId, beforeCount);
  const pendingBefore = openDecisionKinds();
  const resolved = resolveSimplePending(row.pending);
  const state = current();
  return {
    ...dispatch,
    fileCount: state.players.self.file.length,
    opponentFileCount: state.players.opp.file.length,
    entered: state.players.self.scene.some(character => character.cardId === row.cardId),
    pendingBefore,
    pendingSource: resolved.source,
    targetState: state.players.opp.scene[0]?.state,
    settled: resolved.settled,
  };
}

function runChoice(cardId: typeof CHOICE_CARDS[number], beforeCount: number) {
  const dispatch = prepareEntry(cardId, beforeCount);
  const choice = useGameStateStore.getState().pendingEffectChoice;
  const choiceSource = choice?.source.cardId ?? null;
  if (choice) {
    expect(dispatchEngineAction(bindPendingDecision(choice, {
      type: 'choiceResolve', choiceIndex: 0,
    }))).toEqual({ ok: true });
  }
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  const optionalSource = optional?.source.cardId ?? null;
  if (optional) {
    expect(dispatchEngineAction(bindPendingDecision(optional, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
  }
  const state = current();
  return {
    ...dispatch,
    fileCount: state.players.self.file.length,
    opponentFileCount: state.players.opp.file.length,
    entered: state.players.self.scene.some(character => character.cardId === cardId),
    choiceSource,
    optionalSource,
    deck: [...state.players.self.deck],
    remove: [...state.players.self.remove],
    settled: openDecisionKinds().length === 0,
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  resetPendingRuntimeState();
  registerAll();
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('official QA Wave39: an assisting partner counts for FILE7 enter effects', () => {
  it('B04023 surfaces its FILE7 optional only after the public assist reaches seven', () => {
    expect({
      cardId: 'B04023',
      below: runSimple(SIMPLE_ROWS[0]!, 5),
      exact: runSimple(SIMPLE_ROWS[0]!, 6),
    }).toEqual({
      cardId: 'B04023',
      below: { assist: true, handUse: true, fileCount: 6, opponentFileCount: 7, entered: true, pendingBefore: [], pendingSource: null, targetState: 'active', settled: true },
      exact: { assist: true, handUse: true, fileCount: 7, opponentFileCount: 7, entered: true, pendingBefore: ['optional'], pendingSource: 'B04023', targetState: 'active', settled: true },
    });
  });

  it('D09014 surfaces its FILE7 sleep picker only after the public assist reaches seven', () => {
    expect({ cardId: 'D09014', below: runSimple(SIMPLE_ROWS[1]!, 5), exact: runSimple(SIMPLE_ROWS[1]!, 6) }).toEqual({
      cardId: 'D09014',
      below: { assist: true, handUse: true, fileCount: 6, opponentFileCount: 7, entered: true, pendingBefore: [], pendingSource: null, targetState: 'active', settled: true },
      exact: { assist: true, handUse: true, fileCount: 7, opponentFileCount: 7, entered: true, pendingBefore: ['pick'], pendingSource: 'D09014', targetState: 'active', settled: true },
    });
  });

  it('D09015 surfaces its FILE7 sleep picker only after the public assist reaches seven', () => {
    expect({ cardId: 'D09015', below: runSimple(SIMPLE_ROWS[2]!, 5), exact: runSimple(SIMPLE_ROWS[2]!, 6) }).toEqual({
      cardId: 'D09015',
      below: { assist: true, handUse: true, fileCount: 6, opponentFileCount: 7, entered: true, pendingBefore: [], pendingSource: null, targetState: 'active', settled: true },
      exact: { assist: true, handUse: true, fileCount: 7, opponentFileCount: 7, entered: true, pendingBefore: ['pick'], pendingSource: 'D09015', targetState: 'active', settled: true },
    });
  });

  it('PR137 enables its FILE7 choice branch only after the public assist reaches seven', () => {
    expect({ cardId: 'PR137', below: runChoice(CHOICE_CARDS[0], 5), exact: runChoice(CHOICE_CARDS[0], 6) }).toEqual({
      cardId: 'PR137',
      below: { assist: true, handUse: true, fileCount: 6, opponentFileCount: 7, entered: true, choiceSource: 'PR137', optionalSource: null, deck: ['B01001', 'B01002', 'B01003', 'B01004'], remove: [], settled: true },
      exact: { assist: true, handUse: true, fileCount: 7, opponentFileCount: 7, entered: true, choiceSource: 'PR137', optionalSource: 'PR137', deck: ['B01001', 'B01002', 'B01003', 'B01004'], remove: [], settled: true },
    });
  });

  it('PR143 enables its FILE7 choice branch only after the public assist reaches seven', () => {
    expect({ cardId: 'PR143', below: runChoice(CHOICE_CARDS[1], 5), exact: runChoice(CHOICE_CARDS[1], 6) }).toEqual({
      cardId: 'PR143',
      below: { assist: true, handUse: true, fileCount: 6, opponentFileCount: 7, entered: true, choiceSource: 'PR143', optionalSource: null, deck: ['B01001', 'B01002', 'B01003', 'B01004'], remove: [], settled: true },
      exact: { assist: true, handUse: true, fileCount: 7, opponentFileCount: 7, entered: true, choiceSource: 'PR143', optionalSource: 'PR143', deck: ['B01001', 'B01002', 'B01003', 'B01004'], remove: [], settled: true },
    });
  });
});
