import { beforeEach, describe, expect, it } from 'vitest';
import { B04074 } from '@/cards/ct-p04/B04074';
import { event } from '@/engine/event';
import { applyDeckReorderAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';

function character(id: string, level: number, names: string[] = [id]): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names,
    colors: ['黒'],
    level,
    ap: 1000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const PARTNER_Y: CardDef = {
  id: 'B04074_PARTNER',
  no: 'B04074_PARTNER',
  kind: 'partner',
  names: ['test partner'],
  colors: ['黄'],
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};
const KAZAMI = character('B04074_KAZAMI', 4, ['風見裕也']);
const D3 = character('B04074_D3', 3);
const D5 = character('B04074_D5', 5);
const D9 = character('B04074_D9', 9);
const REFRESH = character('B04074_REFRESH', 1);

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetUidCounter();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
  [B04074, PARTNER_Y, KAZAMI, D3, D5, D9, REFRESH].forEach(registerCardDef);
});

describe('B04074 official Q&A', () => {
  it('looks at every card in a short opposing deck, lets that player reorder them, and does not refresh', () => {
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const furuya = mutate.scene.enter(state, 'self', B04074.id, {});
    mutate.scene.enter(state, 'self', KAZAMI.id, {});
    mutate.partner.init(state, 'self', PARTNER_Y.id);
    state.players.opp.deck = [D3.id, D5.id, D9.id];
    state.players.opp.remove = [REFRESH.id];

    activateDeclaredAbility(state, furuya.uid, 'a1');
    runAllUntilEmpty(state);

    expect(state.log.findLast(entry => entry.action === 'souza')?.result).toBe('revealed 3');
    const reorder = _drainPendingDeckReorderSide();
    expect(reorder).toMatchObject({ player: 'opp', cardIds: [D3.id, D5.id, D9.id] });

    applyDeckReorderAndContinuation(state, reorder!, [D9.id, D5.id, D3.id]);
    expect(state.players.opp.deck).toEqual([D9.id, D5.id, D3.id]);
    expect(state.players.opp.remove).toEqual([REFRESH.id]);
    expect(state.refreshCount.opp).toBe(0);
  });
});
