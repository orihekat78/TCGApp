import { beforeEach, describe, expect, it } from 'vitest';
import { B10097 } from '@/cards/ct-p10/B10097';
import { B10102 } from '@/cards/ct-p10/B10102';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const ALLY: CardDef = { id: 'W213_ALLY', no: 'W213_ALLY', kind: 'character', names: ['青黒の味方'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const REVEAL: CardDef = { id: 'W213_REVEAL', no: 'W213_REVEAL', kind: 'character', names: ['毛利蘭'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B10097, B10102, ALLY, REVEAL].forEach(register);
  registerTriggeredListener();
});

describe('official QA Waves213-214: CT-P10 declaration and resolution contracts', () => {
  it('makes B10097 declaration availability depend on both its ally condition and named hand reveal cost', () => {
    const legal = createEmptyGameState();
    legal.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    legal.players.self.scene = [sceneChar(B10097.id, 'b10097'), sceneChar(ALLY.id, 'ally')];
    legal.players.self.hand = [REVEAL.id];

    // qa: card:B10097:1e70299c76c83aad59071a07c014ab6979e9433050db65b525864d09031a3b5b
    expect(canActivateDeclaredAbility(legal, 'b10097', 'a1')).toBe(true);

    const noReveal = structuredClone(legal);
    noReveal.players.self.hand = [];
    // qa: card:B10097:97f468074f3eae1ef823d35c6e825898add698ecc35c8841e1a766b3c6d8c508
    expect(canActivateDeclaredAbility(noReveal, 'b10097', 'a1')).toBe(false);
  });

  it('makes B10102 discard one hand card when its own case resolves', () => {
    const state = createEmptyGameState();
    state.players.self.case = { cardId: B10102.id, status: '事件編', requiredEvidence: 6, colors: ['赤', '黄'], declaredUseCount: {} };
    state.players.self.hand = [REVEAL.id];

    mutate.case.toResolved(state, 'self');
    runAllUntilEmpty(state);

    // qa: card:B10102:7c8677f559c1fed17cde92a36a7f1cb4189ba4b84edfa51e9b7a2e7f05e0555c
    expect(state.players.self.hand).toEqual([]);
    // qa: card:B10102:985a3a2d0d29f762263ace94037481e06612cd9d99ec6c31d2509dcfdf5b8832
    expect(state.players.self.remove).toContain(REVEAL.id);
  });
});
