// qa: card:B09003:45a28272794215b6465b92629940788c48e8cb3de486869a26a5a34e1a4f6a73
// qa: card:B09108:45a28272794215b6465b92629940788c48e8cb3de486869a26a5a34e1a4f6a73
// qa: card:B09111:45a28272794215b6465b92629940788c48e8cb3de486869a26a5a34e1a4f6a73
// Rules: 19-special-rules, 21-declared-ability-cost.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09003 } from '@/cards/ct-p09/B09003';
import { B09003P } from '@/cards/ct-p09/B09003P';
import { B09108 } from '@/cards/ct-p09/B09108';
import { B09108P } from '@/cards/ct-p09/B09108P';
import { B09111 } from '@/cards/ct-p09/B09111';
import { B09111P } from '@/cards/ct-p09/B09111P';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

type Row = {
  card: CardDef;
  abilityId: 'a2' | 'a3';
  abilityIndex: 1 | 2;
  area: 'scene' | 'partner-area' | 'case';
};

const ROWS: Row[] = [
  { card: B09003, abilityId: 'a3', abilityIndex: 2, area: 'scene' },
  { card: B09003P, abilityId: 'a3', abilityIndex: 2, area: 'scene' },
  { card: B09108, abilityId: 'a2', abilityIndex: 1, area: 'partner-area' },
  { card: B09108P, abilityId: 'a2', abilityIndex: 1, area: 'partner-area' },
  { card: B09111, abilityId: 'a2', abilityIndex: 1, area: 'case' },
  { card: B09111P, abilityId: 'a2', abilityIndex: 1, area: 'case' },
];

const REGISTERED_EVENT = 'W105-REGISTERED-EVENT';
const REGISTERED_NAME = '波百五登録事件';
const UNREGISTERED_NAME = '波百五未登録名';
const HATTORI = 'W105-HATTORI';
const FILE_CARD = 'W105-FILE-CARD';
const DECK_A = 'W105-DECK-A';
const DECK_B = 'W105-DECK-B';
const LEVEL_SIX = 'W105-LEVEL-SIX';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: id, kind, names: [id], colors: ['青'], traits: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
    ...(kind === 'character' ? { level: 1, ap: 1000, lp: 1 } : {}),
    ...options,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function sourceUid(row: Row, owner: Player): string {
  if (row.area === 'case') return `case:${owner}`;
  if (row.area === 'partner-area') return `partnerMR:${owner}`;
  return `wave105-${owner}-${row.card.id}`;
}

function stateFor(row: Row, owner: Player): GameState {
  const target = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 17, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].deck = [DECK_A, DECK_B, DECK_A, DECK_B];
  state.players[target].deck = [DECK_B, DECK_A, DECK_B];
  state.players[target].file = [{ type: 'card-back', cardId: FILE_CARD }];
  if (row.area === 'scene') {
    state.players[owner].scene = [
      makeChar({ cardId: row.card.id, uid: sourceUid(row, owner) }),
      makeChar({ cardId: HATTORI, uid: `wave105-${owner}-hattori` }),
    ];
  } else if (row.area === 'partner-area') {
    state.players[owner].partnerAreaMR = makeChar({ cardId: row.card.id, uid: sourceUid(row, owner) });
  } else {
    state.players[owner].case = {
      ...state.players[owner].case,
      cardId: row.card.id,
      colors: [...row.card.colors],
      status: '解決編',
      requiredEvidence: 7,
      declaredUseCount: {},
    };
    state.players[owner].evidence = [0, 1].map(index => ({
      cardId: `W105-EVIDENCE-${index}`, faceUp: false,
      origin: { turn: 1, via: 'reasoning' as const },
    }));
    state.players[owner].scene = [makeChar({ cardId: LEVEL_SIX, uid: `wave105-${owner}-level-six` })];
  }
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave105-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave105 state');
  return state;
}

function dispatch(row: Row, owner: Player, declaredName: string) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: sourceUid(row, owner), abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
    costParams: {
      ...(row.area === 'case' ? { flipFaceUpEvidence: { indices: [0, 1] } } : {}),
      declaredName,
    },
  });
}

function expectPaidCostPreserved(row: Row, state: GameState): void {
  if (row.card.id.startsWith('B09003')) {
    expect(state.players.self.deck).toHaveLength(3);
    expect(state.players.self.remove).toHaveLength(1);
  }
  if (row.card.id.startsWith('B09111')) {
    expect(state.players.self.evidence.map(card => card.faceUp)).toEqual([true, true]);
  }
}

function legacyDefinition(row: Row): CardDef {
  const legacy = structuredClone(row.card);
  const ability = legacy.abilities.find(candidate => candidate.id === row.abilityId);
  const declare = ability?.effect?.kind === 'chain' ? ability.effect.steps[0] : undefined;
  if (declare?.kind !== 'atom' || declare.verb !== 'declareName') {
    throw new Error(`missing ${row.card.id}/${row.abilityId} legacy declareName step`);
  }
  delete (declare.args as { domain?: string }).domain;
  return legacy;
}

function registerFixtures(): void {
  registerAll();
  register(fixture(REGISTERED_EVENT, { kind: 'event', names: [REGISTERED_NAME] }));
  register(fixture(HATTORI, { names: ['服部平次'] }));
  register(fixture(FILE_CARD));
  register(fixture(DECK_A));
  register(fixture(DECK_B));
  register(fixture(LEVEL_SIX, { level: 6 }));
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerFixtures();
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave105: a declared card name comes from the registered all-card domain', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner rejects an unregistered name transactionally',
    ({ row, owner }) => {
      install(stateFor(row, owner), owner, `${row.card.id}-${owner}-invalid`);
      const before = current();
      const beforeJson = JSON.stringify(before);

      expect(dispatch(row, owner, UNREGISTERED_NAME)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(JSON.stringify(current())).toBe(beforeJson);
      expect(readChar.declaredUseCount(current(), sourceUid(row, owner), row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      })).toBe(0);
    },
  );

  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner accepts one registered event name without a card number or ID',
    ({ row, owner }) => {
      install(stateFor(row, owner), owner, `${row.card.id}-${owner}-registered`);
      const target = other(owner);

      expect(dispatch(row, owner, REGISTERED_NAME)).toEqual({ ok: true });
      // Card-bound physical rows: B09003/P, B09108/P, B09111/P.
      expect(current().players[target].remove).toContain(FILE_CARD);
      expect(readChar.declaredUseCount(current(), sourceUid(row, owner), row.abilityId, {
        abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      })).toBe(1);
    },
  );

  it.each(ROWS)('$card.id hydrates and resumes its exact pre-domain human decision', row => {
    register(legacyDefinition(row));
    install(stateFor(row, 'self'), 'self', `${row.card.id}-legacy-save`);

    expect(dispatch(row, 'self', FILE_CARD)).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pendingBefore = useGameStateStore.getState().pendingEffectPick;
    const expectedVerb = row.card.id.startsWith('B09003')
      ? 'charModifyAP'
      : row.card.id.startsWith('B09108') ? 'discard' : 'charGrantKeyword';
    expect(pendingBefore?.atomVerb).toBe(expectedVerb);
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expectPaidCostPreserved(row, saved);
    expect(JSON.stringify(saved.pendingEffects)).not.toContain('"registered-card-name"');

    resetPendingRuntimeState();
    _resetRegistry();
    registerFixtures();
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    expectPaidCostPreserved(row, current());
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.atomVerb).toBe(expectedVerb);
    const picked = expectedVerb === 'discard'
      ? pending!.candidates.slice(0, 2).map(candidate => candidate.uid)
      : [pending!.candidates.find(candidate => candidate.cardId === LEVEL_SIX)?.uid
        ?? pending!.candidates[0]!.uid];
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: picked[0]!,
      ...(picked.length > 1 ? { pickedUids: picked } : {}),
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().pendingEffects.find(entry => (
      entry.source.cardId === row.card.id && entry.source.abilityId === row.abilityId
    ))?.state).toBe('resolved');
  });
});
