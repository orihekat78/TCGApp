// qa: card:B04019:a1ea0a1b03ae906d9062ba5906497c7178e10970f12b5935b23937f559152d86
// qa: card:B07025:a1ea0a1b03ae906d9062ba5906497c7178e10970f12b5935b23937f559152d86
// qa: card:B07079:a1ea0a1b03ae906d9062ba5906497c7178e10970f12b5935b23937f559152d86
// qa: card:B07080:a1ea0a1b03ae906d9062ba5906497c7178e10970f12b5935b23937f559152d86
// Rules: 21-declared-ability-cost.md. A colon-left scene cost can use only its owner cards.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04019 } from '@/cards/ct-p04/B04019';
import { B07025 } from '@/cards/ct-p07/B07025';
import { B07079 } from '@/cards/ct-p07/B07079';
import { B07079P } from '@/cards/ct-p07/B07079P';
import { B07080 } from '@/cards/ct-p07/B07080';
import { B07080P } from '@/cards/ct-p07/B07080P';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const COST_CARD = 'QA_W92_COST_CARD';
const VICTIM = 'QA_W92_VICTIM';
const YELLOW_PARTNER = 'QA_W92_YELLOW_PARTNER';
const TAIL = 'QA_W92_TAIL';

type Row = { card: CardDef; abilityId: 'a1' | 'a2'; sleeps: boolean };
const ROWS: readonly Row[] = [
  { card: B04019, abilityId: 'a1', sleeps: false },
  { card: B07025, abilityId: 'a1', sleeps: true },
  { card: B07079, abilityId: 'a1', sleeps: true },
  { card: B07079P, abilityId: 'a1', sleeps: true },
  { card: B07080, abilityId: 'a2', sleeps: true },
  { card: B07080P, abilityId: 'a2', sleeps: true },
];

function fixture(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `QA/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 7, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...overrides,
  };
}

const FIXTURES = [
  fixture(COST_CARD, { names: ['服部平次'], traits: ['警察', '警視庁', 'マジシャン'] }),
  fixture(VICTIM, { level: 1, ap: 1000 }),
  fixture(YELLOW_PARTNER, { kind: 'partner', level: undefined, ap: undefined, colors: ['黄'] }),
  fixture(TAIL, { level: 1 }),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function sourceUid(owner: Player): string {
  return `${owner}-source`;
}

function costUid(owner: Player): string {
  return `${owner}-cost`;
}

function stateFor(row: Row, owner: Player, includeOwnerCost: boolean): GameState {
  const state = createEmptyGameState();
  const opponent = other(owner);
  state.turn = { number: 7, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: YELLOW_PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].file = Array.from({ length: 5 }, (_value, index) => ({ type: 'card-back' as const, cardId: `QA_W92_FILE_${index}` }));
  state.players[owner].scene = [makeChar({ cardId: row.card.id, uid: sourceUid(owner), state: 'active' })];
  if (includeOwnerCost) state.players[owner].scene.push(makeChar({ cardId: COST_CARD, uid: costUid(owner), state: 'active' }));
  state.players[opponent].scene = [
    makeChar({ cardId: COST_CARD, uid: costUid(opponent), state: 'active' }),
    makeChar({ cardId: VICTIM, uid: `${opponent}-victim`, state: 'active' }),
  ];
  state.players[owner].deck = [TAIL];
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave92-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave92 game state');
  return state;
}

function declare(row: Row, owner: Player, payerUid: string) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: sourceUid(owner), abilId: row.abilityId,
    costParams: { sceneToDeckBottom: { uids: [payerUid] } },
  });
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('Wave92 public declared scene costs are owner-only', () => {
  it.each(ROWS)('$card.id rejects an opponent-only payer without partial cost', row => {
    const state = stateFor(row, 'self', false);
    install(state, `${row.card.id}-opponent-only`, 'self');
    const before = current();
    const beforeJson = JSON.stringify(before);

    // Card-bound opponent rejection matrix: B04019 B07025 B07079 B07079P B07080 B07080P.
    expect(declare(row, 'self', costUid('opp'))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(current().players.self.scene.find(entry => entry.uid === 'self-source')?.state).toBe('active');
    expect(current().players.opp.scene.some(entry => entry.uid === 'opp-cost')).toBe(true);
  });

  it.each(ROWS)('$card.id pays with the chosen owner card while preserving the opponent decoy', row => {
    install(stateFor(row, 'self', true), `${row.card.id}-owner-self`, 'self');

    expect(declare(row, 'self', costUid('self'))).toEqual({ ok: true });
    // Card-bound owner payment matrix: B04019 B07025 B07079 B07079P B07080 B07080P.
    expect(current().players.self.scene.some(entry => entry.uid === 'self-cost')).toBe(false);
    expect(current().players.self.deck.at(-1)).toBe(COST_CARD);
    expect(current().players.opp.scene.some(entry => entry.uid === 'opp-cost')).toBe(true);
    expect(current().players.self.scene.find(entry => entry.uid === 'self-source')?.state)
      .toBe(row.sleeps ? 'sleep' : 'active');
  });

  it.each(ROWS)('$card.id applies the same owner-relative rule when controlled by opp', row => {
    install(stateFor(row, 'opp', true), `${row.card.id}-owner-opp`, 'opp');

    expect(declare(row, 'opp', costUid('opp'))).toEqual({ ok: true });
    // Card-bound opponent-owner matrix: B04019 B07025 B07079 B07079P B07080 B07080P.
    expect(current().players.opp.scene.some(entry => entry.uid === 'opp-cost')).toBe(false);
    expect(current().players.opp.deck.at(-1)).toBe(COST_CARD);
    expect(current().players.self.scene.some(entry => entry.uid === 'self-cost')).toBe(true);
  });
});
