import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01050 } from '@/cards/ct-p01/B01050';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { createMainGameState } from '../../helpers/main-game-state';

const WHITE = 'BUG331_WHITE';
const TAIL = 'BUG331_TAIL';
const PARTNER = 'BUG331_PARTNER';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing BUG-331 public state');
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  register(fixture(WHITE, { colors: ['白'] }));
  register(fixture(TAIL));
  register(fixture(PARTNER, { kind: 'partner', colors: ['白'], level: 0, lp: 5 }));
  registerTriggeredListener();
  beginMatchSession('self');
  resetPresentationQueue('bug-331-reveal-complete');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetActionContexts();
  endMatchSession();
  useGameStateStore.getState().resetMatchSessionState();
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('BUG-331 matched-only reveal presentation', () => {
  it('B01050 public hand use reveals white, moves it to hand, and claims no bottom or shuffle', () => {
    const state = createMainGameState();
    state.players.self.partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.case.colors = ['白'];
    state.players.self.hand = [B01050.id];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: TAIL }));
    state.players.self.deck = [WHITE, TAIL];
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B01050.id })).toEqual({ ok: true });
    const group = pendingOwnerOrderGroup(current(), 'self')
      .filter(entry => entry.source.cardId === B01050.id)
      .sort((left, right) => (left.source.abilityId ?? '').localeCompare(right.source.abilityId ?? ''));
    expect(group.map(entry => entry.source.abilityId)).toEqual(['a1', 'a2']);
    group.forEach((entry, order) => {
      expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: entry.id, order, player: 'self' }))
        .toEqual({ ok: true });
    });
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: group.map(entry => entry.id),
    })).toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'self', visibility: 'public', viewer: 'all',
      revealed: [WHITE], matched: WHITE, presentation: 'reveal-complete',
      source: { cardId: B01050.id, abilityId: 'a2' },
    });
    expect(current().players.self.hand).toContain(WHITE);
    expect(current().players.self.deck).toEqual([TAIL]);
    expect(current().log.some(entry => entry.action === 'effect:deckShuffle')).toBe(false);
  });
});
