// qa: card:B10079:9c36fc1f22ed7e16bfb24c61c926e5813bd7282d9fe097982c438f4cbbffb0fe
// qa: card:B10081:a099918bb3e6011c1e68bec07a7edf954a710e2ccf34a99dd5b76b5188acfdca
// qa: card:B10082:ec638c23ba71a38fa46f798333de80fbf5c8d7b3b9b206bc6b826958aabb0181
// qa: card:B10083:e0c7ae6475a350f45f27d1aef1937d2deb210c80000d2b6a4d9eb7d869dcb5c5

import { beforeEach, describe, expect, it } from 'vitest';
import { B10079 } from '@/cards/ct-p10/B10079';
import { B10081 } from '@/cards/ct-p10/B10081';
import { B10082 } from '@/cards/ct-p10/B10082';
import { B10083 } from '@/cards/ct-p10/B10083';
import { candidates, canGuard } from '@/engine/flow/guard';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const ATTACKER: CardDef = {
  id: 'W209_ATTACKER', no: 'W209_ATTACKER', kind: 'character', names: ['攻撃側'], colors: ['黄'],
  level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

beforeEach(() => {
  _resetRegistry();
  [ATTACKER, B10079].forEach(register);
});

describe('official QA Wave209: CT-P10 guard, effective-level, and exact-cost contracts', () => {
  it('keeps B10079 outside every legal guard candidate', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar(ATTACKER.id, 'attacker')];
    state.players.opp.scene = [sceneChar(B10079.id, 'bomb')];

    expect(candidates(state, 'attacker')).toEqual([]);
    expect(canGuard(state, 'attacker', 'bomb')).toBe(false);
  });

  it('uses B10081 moved-card binding at resolution time for the minimum target level', () => {
    expect(B10081.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'triggered',
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'handAddFromRemove', args: { bind: '$moved' } },
          { kind: 'conditional', if: { kind: 'bound', key: '$moved', presence: 'matched' }, then: { verb: 'sceneRemove', args: { filter: { levelMinBound: { bindKey: '$moved' } } } } },
        ],
      },
    });
  });

  it('makes B10082 refresh only after the looked remainder moves to remove', () => {
    expect(B10082.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'deckRevealUntil', args: { maxN: 2, chooseMatch: 'upTo' } },
          { kind: 'conditional', then: { verb: 'handAddFromDeck', args: { deferRefresh: true } } },
          { kind: 'atom', verb: 'boundToRemove', args: { refreshAfter: true } },
        ],
      },
    });
  });

  it('requires exactly three face-down own evidence for B10083 before resolution', () => {
    expect(B10083.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      type: 'declared',
      cost: { kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } },
    });
  });
});
