// qa: card:B09108:52e25d1fb9d3623390ecb00ccb1047978985d54514cf0287453e6c0e3105c82a
// qa: card:B09111:52e25d1fb9d3623390ecb00ccb1047978985d54514cf0287453e6c0e3105c82a
// qa: card:B09112:45a28272794215b6465b92629940788c48e8cb3de486869a26a5a34e1a4f6a73
// qa: card:B09112:52e25d1fb9d3623390ecb00ccb1047978985d54514cf0287453e6c0e3105c82a
// Rules: 19-special-rules, 21-declared-ability-cost.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09108 } from '@/cards/ct-p09/B09108';
import { B09108P } from '@/cards/ct-p09/B09108P';
import { B09111 } from '@/cards/ct-p09/B09111';
import { B09111P } from '@/cards/ct-p09/B09111P';
import { B09112 } from '@/cards/ct-p09/B09112';
import { B09112P } from '@/cards/ct-p09/B09112P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
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
  area: 'partner-area' | 'case';
  abilityIndex: 1;
  positiveVerb: 'discard' | 'charGrantKeyword' | 'deckRevealUntil';
};

const ROWS: Row[] = [
  { card: B09108, area: 'partner-area', abilityIndex: 1, positiveVerb: 'discard' },
  { card: B09108P, area: 'partner-area', abilityIndex: 1, positiveVerb: 'discard' },
  { card: B09111, area: 'case', abilityIndex: 1, positiveVerb: 'charGrantKeyword' },
  { card: B09111P, area: 'case', abilityIndex: 1, positiveVerb: 'charGrantKeyword' },
  { card: B09112, area: 'case', abilityIndex: 1, positiveVerb: 'deckRevealUntil' },
  { card: B09112P, area: 'case', abilityIndex: 1, positiveVerb: 'deckRevealUntil' },
];

const COMBINED_NAME = '工藤新一&服部平次';
const COMBINED_CARD = 'B09108';
const COMPONENT_CARD = 'D02001';
const DRAW = fixture('W107-CONSUMER-DRAW', ['ドロー用']);
const LEVEL_SIX = fixture('W107-CONSUMER-L6', ['レベル6'], { level: 6 });

function fixture(id: string, names: string[], options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: ['青'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function sourceUid(row: Row, owner: Player): string {
  return row.area === 'case' ? `case:${owner}` : `partnerMR:${owner}`;
}

function stateFor(row: Row, owner: Player, exactMatch: boolean): GameState {
  const target = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 19, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[target].deck = [DRAW.id, DRAW.id];
  state.players[target].file = [{
    type: 'card-back',
    cardId: exactMatch ? COMBINED_CARD : COMPONENT_CARD,
  }];
  state.players[owner].deck = row.positiveVerb === 'deckRevealUntil'
    ? [COMBINED_CARD, COMPONENT_CARD, DRAW.id]
    : [DRAW.id, DRAW.id, DRAW.id, DRAW.id];
  state.players[owner].scene = row.positiveVerb === 'deckRevealUntil'
    ? [
        ...(exactMatch ? [makeChar({ cardId: COMBINED_CARD, uid: `w107-${owner}-combined` })] : []),
        makeChar({ cardId: COMPONENT_CARD, uid: `w107-${owner}-component` }),
      ]
    : [makeChar({ cardId: LEVEL_SIX.id, uid: `w107-${owner}-level-six` })];
  if (row.area === 'partner-area') {
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
      cardId: `W107-EVIDENCE-${index}`,
      faceUp: false,
      origin: { turn: 1, via: 'reasoning' as const },
    }));
  }
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function dispatch(row: Row, owner: Player) {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: sourceUid(row, owner),
    abilId: 'a2',
    abilityOrigin: 'printed',
    abilityIndex: row.abilityIndex,
    costParams: {
      ...(row.area === 'case' ? { flipFaceUpEvidence: { indices: [0, 1] } } : {}),
      declaredName: COMBINED_NAME,
    },
  });
}

function legacyDefinition(card: CardDef): CardDef {
  const legacy = structuredClone(card);
  const ability = legacy.abilities.find(candidate => candidate.id === 'a2');
  const declare = ability?.effect?.kind === 'sequence' ? ability.effect.steps[0] : undefined;
  if (declare?.kind !== 'atom' || declare.verb !== 'declareName') {
    throw new Error(`missing ${card.id}/a2 declareName step`);
  }
  delete (declare.args as { domain?: string }).domain;
  return legacy;
}

function registerFixtures(): void {
  registerAll();
  for (const card of [DRAW, LEVEL_SIX]) register(card);
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
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  resetPendingRuntimeState();
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave107: combined-name consumers require the exact combined name', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner resolves its combined-name branch',
    ({ row, owner }) => {
      install(stateFor(row, owner, true), owner, `wave107-${row.card.id}-${owner}-exact`);
      expect(dispatch(row, owner)).toEqual({ ok: true });
      const pending = useGameStateStore.getState().pendingEffectPick;

      // Card-bound physical rows: B09108/P, B09111/P, B09112/P.
      expect(pending?.atomVerb).toBe(row.positiveVerb);
      if (row.positiveVerb === 'deckRevealUntil') {
        expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual([COMBINED_CARD]);
      }
    },
  );

  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner does not treat one component as the declared combined name',
    ({ row, owner }) => {
      install(stateFor(row, owner, false), owner, `wave107-${row.card.id}-${owner}-component`);
      expect(dispatch(row, owner)).toEqual({ ok: true });
      const pending = useGameStateStore.getState().pendingEffectPick;
      if (row.positiveVerb === 'deckRevealUntil') {
        expect(pending).toMatchObject({ atomVerb: 'deckRevealUntil', nMax: 0, candidates: [] });
      } else {
        expect(pending).toBeNull();
      }
    },
  );

  it.each([B09112, B09112P])('$id hydrates and resumes its exact pre-domain combined-name decision', card => {
    register(legacyDefinition(card));
    const row = ROWS.find(candidate => candidate.card.id === card.id)!;
    install(stateFor(row, 'self', true), 'self', `wave107-${card.id}-legacy-save`);
    expect(dispatch(row, 'self')).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb).toBe('deckRevealUntil');
    const saved = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState)) as GameState;

    resetPendingRuntimeState();
    _resetRegistry();
    registerFixtures();
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.candidates.map(candidate => candidate.cardId)).toEqual([COMBINED_CARD]);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid: pending.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().gameState?.pendingEffects.find(entry => (
      entry.source.cardId === card.id && entry.source.abilityId === 'a2'
    ))?.state).toBe('resolved');
  });
});
