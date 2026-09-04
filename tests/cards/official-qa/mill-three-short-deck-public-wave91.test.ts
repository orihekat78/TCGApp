// qa: card:B05068:22aaf9ba5e384ee444adeadb5ffb7b5c97b7a4e75ccbac8c297b8c86d3e85f3f
// qa: card:PR132:22aaf9ba5e384ee444adeadb5ffb7b5c97b7a4e75ccbac8c297b8c86d3e85f3f
// qa: card:PR201:22aaf9ba5e384ee444adeadb5ffb7b5c97b7a4e75ccbac8c297b8c86d3e85f3f
// qa: card:PR207:22aaf9ba5e384ee444adeadb5ffb7b5c97b7a4e75ccbac8c297b8c86d3e85f3f
// qa: card:PR285:22aaf9ba5e384ee444adeadb5ffb7b5c97b7a4e75ccbac8c297b8c86d3e85f3f
// qa: card:B10096:22aaf9ba5e384ee444adeadb5ffb7b5c97b7a4e75ccbac8c297b8c86d3e85f3f
// Rules: 14-refresh.md, 15-abilities-effects.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05068 } from '@/cards/ct-p05/B05068';
import { B10096, B10096P } from '@/cards/ct-p10/B10096';
import { PR132 } from '@/cards/pr-01/PR132';
import { PR201 } from '@/cards/pr-01/PR201';
import { PR207 } from '@/cards/pr-01/PR207';
import { PR285 } from '@/cards/pr-01/PR285';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { char as readChar } from '@/engine/read/char';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

const CASE = 'QA_W91_CASE';
const FILLERS = ['QA_W91_FILLER_0', 'QA_W91_FILLER_1', 'QA_W91_FILLER_2'] as const;
const COLORS = ['赤', '黄', '白', '黒'] as const;

function fixture(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `QA/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...overrides,
  };
}

const PARTNERS = Object.fromEntries(COLORS.map(color => [color, `QA_W91_PARTNER_${color}`])) as Record<(typeof COLORS)[number], string>;
const FIXTURES: CardDef[] = [
  fixture(CASE, { kind: 'case', level: undefined, ap: undefined, lp: undefined, caseLevel: 7, colors: [...COLORS], caseTraits: [] }),
  ...FILLERS.map(id => fixture(id)),
  ...COLORS.map(color => fixture(PARTNERS[color], { kind: 'partner', level: undefined, ap: undefined, colors: [color] })),
];

const ROWS = [
  { card: B05068, partnerColor: '赤' },
  { card: PR132, partnerColor: '黄' },
  { card: PR285, partnerColor: '黄' },
  { card: PR201, partnerColor: '白' },
  { card: PR207, partnerColor: '白' },
  { card: B10096, partnerColor: '黒' },
  { card: B10096P, partnerColor: '黒' },
] as const;

function fileCards(count: number) {
  return Array.from({ length: count }, (_value, index) => ({ type: 'card-back' as const, cardId: `QA_W91_FILE_${index}` }));
}

function install(card: CardDef, partnerColor: keyof typeof PARTNERS, deck: string[], label: string): void {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = { cardId: CASE, status: 'unresolved', requiredEvidence: 7, colors: [...COLORS], declaredUseCount: {} };
  state.players.self.partner = { cardId: PARTNERS[partnerColor], state: 'active', location: 'partner-area' };
  state.players.self.file = fileCards(8);
  state.players.self.hand = [card.id];
  state.players.self.deck = [...deck];
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-wave91-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave91 game state');
  return state;
}

function useAndAccept(card: CardDef): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ source: { cardId: card.id, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });
  surfacePendingSideChannels();
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('Wave91 public optional mill-three deck-size gate', () => {
  it.each(ROWS)('$card.id keeps a two-card deck unchanged and suppresses every dependent branch', ({ card, partnerColor }) => {
    const deck = [...FILLERS.slice(0, 2)];
    install(card, partnerColor, deck, `${card.id}-two`);
    useAndAccept(card);

    // Card-bound short-deck matrix: B05068 PR132 PR201 PR207 PR285 B10096 B10096P.
    expect(current().players.self.deck).toEqual(deck);
    expect(current().players.self.remove.filter(cardId => deck.includes(cardId as (typeof FILLERS)[number]))).toEqual([]);
    expect(current().refreshCount.self).toBe(0);
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    const source = current().players.self.scene.find(entry => entry.cardId === card.id);
    if (source) expect(readChar.keywords(current(), source.uid)).not.toContain('突撃');
  });

  it.each([0, 1])('B05068 also leaves a %i-card deck untouched', deckSize => {
    const deck = [...FILLERS.slice(0, deckSize)];
    install(B05068, '赤', deck, `B05068-${deckSize}`);
    useAndAccept(B05068);

    expect(current().players.self.deck).toEqual(deck);
    expect(current().refreshCount.self).toBe(0);
  });

  it.each(ROWS)('$card.id processes all three cards at the exact boundary', ({ card, partnerColor }) => {
    const deck = [...FILLERS];
    install(card, partnerColor, deck, `${card.id}-three`);
    useAndAccept(card);

    // Card-bound exact-three matrix: B05068 PR132 PR201 PR207 PR285 B10096 B10096P.
    expect(current().refreshCount.self).toBe(1);
    expect([...current().players.self.deck].sort()).toEqual([...deck].sort());
    expect(current().players.self.remove).toEqual(card.kind === 'event' ? [card.id] : []);
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
