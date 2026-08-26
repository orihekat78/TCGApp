import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B10006 } from '@/cards/ct-p10/B10006';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as charRead } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { sceneChar } from '../../../helpers/fixtures';

const KUDO: CardDef = {
  id: 'ORDER_B10006_KUDO', no: 'test/KUDO', kind: 'character', names: ['工藤新一'],
  colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
  imageUrl: '', abilities: [], ruleRefs: [],
};

const SOURCE: CardDef = {
  id: 'ORDER_B10006_SOURCE', no: 'test/SOURCE', kind: 'character', names: ['公開元'],
  colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
  imageUrl: '', ruleRefs: [], abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    cost: {
      kind: 'revealFromHand', n: 1,
      target: {
        kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: '工藤新一' } },
        n: { min: 1, max: 1 }, chooser: 'self',
      },
    },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: '工藤新一を公開してから、この宣言効果を解決する。', ruleRefs: [],
  }],
};

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [B10006, KUDO, SOURCE].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('declared reveal-cost ordering for B10006', () => {
  it('resolves the declared source before its hand-reveal reaction', () => {
    const state = createEmptyGameState();
    state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['青', '黒'];
    state.players.self.file = Array.from({ length: 5 }, (_, index) => ({
      type: 'card-back' as const, cardId: `file:${index}`,
    }));
    state.players.self.hand = [KUDO.id];
    state.players.self.scene = [
      sceneChar(B10006.id, 'ran', { state: 'sleep' }),
      sceneChar(SOURCE.id, 'source'),
    ];

    activateDeclaredAbility(state, 'source', 'a1', {
      revealFromHand: { indices: [0] },
    });
    runAllUntilEmpty(state);

    expect(state.pendingEffects.find(entry => entry.source.cardId === SOURCE.id)?.state)
      .toBe('resolved');
    expect(charRead.ap(state, 'ran')).toBe(7000);
  });
});
