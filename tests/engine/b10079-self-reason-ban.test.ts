import { beforeEach, describe, expect, it } from 'vitest';
import { canReason } from '@/engine/flow/main/reasoning';
import { _resetRegistry, register } from '@/engine/read/def';
import { createMainGameState as createEmptyGameState } from '../helpers/main-game-state';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const BOMB: CardDef = {
  id: 'B10079_TEST', no: 'TEST/B10079', kind: 'character', names: ['爆弾犯'],
  colors: ['黄'], level: 5, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C',
  imageUrl: '', ruleRefs: [], abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene',
    continuousModifier: { selfReasonBan: true }, description: 'このキャラは推理できない。', ruleRefs: [],
  }],
};

beforeEach(() => _resetRegistry());

describe('B10079 continuous reason ban', () => {
  it('blocks only the bearer and original-ability disable restores ordinary reasoning', () => {
    register(BOMB);
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar(BOMB.id, 'bomb#1')];
    expect(canReason(state, 'bomb#1')).toBe(false);
    state.players.self.scene[0]!.keywordOverrides.disabledOriginal = true;
    expect(canReason(state, 'bomb#1')).toBe(true);
  });
});
