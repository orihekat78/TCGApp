import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { event } from '@/engine/event';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { read } from '@/engine/read';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { B05088 } from '@/cards/ct-p05/B05088';
import { B05088P } from '@/cards/ct-p05/B05088P';
import { B05088P2 } from '@/cards/ct-p05/B05088P2';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const NAGANO: CardDef = { id: 'B05088_NAGANO', no: 'test/NAGANO', kind: 'character', names: ['Nagano'], colors: ['yellow'], level: 1, ap: 1000, lp: 1, traits: ['長野県警'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const TARGET: CardDef = { id: 'B05088_TARGET', no: 'test/TARGET', kind: 'character', names: ['Target'], colors: ['blue'], level: 1, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PARTNER: CardDef = { id: 'B05088_PARTNER', no: 'test/PARTNER', kind: 'character', names: ['Partner'], colors: ['黄'], level: 1, ap: 0, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const YUI: CardDef = { id: 'B05088_YUI', no: 'test/YUI', kind: 'character', names: ['上原由衣'], colors: ['黄'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

beforeEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
  (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
  event._resetRegistry(); _resetTriggeredRegistered(); _resetRegistry(); _clearPendingEffectPickQueue();
  [B05088, B05088P, B05088P2, NAGANO, TARGET, PARTNER, YUI].forEach(registerCardDef);
  registerTriggeredListener();
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

function setup() {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene.push(sceneChar('B05088', 'kansuke'), sceneChar('B05088_TARGET', 'target'));
  state.players.self.remove = ['B05088_NAGANO'];
  return state;
}

function resolveDebuffPick(state: ReturnType<typeof createEmptyGameState>) {
  runAllUntilEmpty(state);
  const pick = _drainPendingEffectPickSide();
  expect(pick).toMatchObject({ atomVerb: 'charModifyAP', player: 'self' });
  expect(pick?.candidates.map(c => c.uid)).toContain('target');
  applyPickAndContinuation(state, pick!, 'target');
}

function confirmOwnerOrder(state: ReturnType<typeof createEmptyGameState>) {
  const group = pendingOwnerOrderGroup(state, 'self');
  expect(group).toHaveLength(2);
  group.forEach((entry, order) => {
    entry.ownerChosenOrder = order;
    entry.ownerOrderConfirmed = true;
  });
}

describe('B05088 大和敢助', () => {
  it('P/P2 have identical printed rules', () => {
    const printed = (card: CardDef) => ({ ...card, id: '', no: '', rarity: '', imageUrl: '' });
    expect(printed(B05088)).toEqual(printed(B05088P));
    expect(printed(B05088)).toEqual(printed(B05088P2));
    expect(B05088P.abilities).not.toBe(B05088.abilities);
    expect(B05088P2.abilities).not.toBe(B05088.abilities);
  });

  it('a1 bond counts Uehara Yui in the scene, never the partner area', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar('B05088', 'kansuke')];
    mutate.partner.init(state, 'self', YUI.id);

    expect(read.char.ap(state, 'kansuke'), 'partner-area Yui does not satisfy bond').toBe(6000);
    state.players.self.scene.push(sceneChar(YUI.id, 'yui'));
    expect(read.char.ap(state, 'kansuke'), 'scene Yui satisfies bond on own turn').toBe(7000);

    state.turn.player = 'opp';
    expect(read.char.ap(state, 'kansuke'), 'own-turn condition still applies independently').toBe(6000);
  });

  it('a2 production dispatch observes refresh remove exit and debuffs either-field target', () => {
    const state = setup();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    mutate.deck.refresh(state, 'self');
    resolveDebuffPick(state);
    expect(state.players.self.remove).not.toContain('B05088_NAGANO');
    expect(state.players.self.deck).toContain('B05088_NAGANO');
    expect(read.char.ap(state, 'target')).toBe(2000);
  });

  it('a3 declared cost dispatch moves Nagano card to deck bottom and causes a2', () => {
    const state = setup();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    mutate.partner.init(state, 'self', 'B05088_PARTNER');
    activateDeclaredAbility(state, 'kansuke', 'a3');
    confirmOwnerOrder(state);
    resolveDebuffPick(state);
    expect(state.players.self.remove).not.toContain('B05088_NAGANO');
    expect(state.players.self.deck.at(-1)).toBe('B05088_NAGANO');
    expect(read.char.ap(state, 'target')).toBe(2000);
  });
});
