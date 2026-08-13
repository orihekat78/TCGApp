import { describe, expect, it } from 'vitest';
import {
  canApplyPendingPickSelection,
  maximumFeasiblePendingPickSelection,
  pendingPickSelectionViolation,
} from '@/engine/effect/pick-selection';
import type { PendingEffectPickSide } from '@/engine/effect/pending-state';
import { register as registerCardDef, _resetRegistry as resetCardRegistry } from '@/engine/read/def';

function pending(
  forcedUids: string[],
  nMax: number,
): PendingEffectPickSide {
  return {
    player: 'self',
    candidates: [
      { uid: 'forced-1', cardId: 'FORCED_1', player: 'opp', kind: 'char' },
      { uid: 'forced-2', cardId: 'FORCED_2', player: 'opp', kind: 'char' },
      { uid: 'plain', cardId: 'PLAIN', player: 'opp', kind: 'char' },
    ],
    atomVerb: 'sceneRemove',
    atomArgs: {},
    nMin: 1,
    nMax,
    source: { cardId: 'EVENT', abilityId: 'a1' },
    forcedUids,
  };
}

describe('mustBeSelectedByOppEvent forced selection cardinality', () => {
  it('requires the sole forced candidate while leaving the remaining slot available', () => {
    const pick = pending(['forced-1'], 2);

    expect(pendingPickSelectionViolation(pick, ['forced-1', 'plain'])).toBeNull();
    expect(pendingPickSelectionViolation(pick, ['plain'])).toBe('required candidate omitted');
    expect(maximumFeasiblePendingPickSelection(pick)).toEqual(['forced-1', 'forced-2']);
  });

  it('allows either forced candidate when the forced set exceeds nMax', () => {
    const pick = pending(['forced-1', 'forced-2'], 1);

    expect(canApplyPendingPickSelection(pick, 'forced-1')).toBe(true);
    expect(canApplyPendingPickSelection(pick, 'forced-2')).toBe(true);
    expect(canApplyPendingPickSelection(pick, 'plain')).toBe(false);
  });

  it('searches all forced subsets when the first forced pair violates an aggregate constraint', () => {
    resetCardRegistry();
    for (const [id, level] of [['FORCED_1', 6], ['FORCED_2', 6], ['PLAIN', 4]] as const) {
      registerCardDef({
        id, no: id, kind: 'character', names: [id], colors: ['赤'], level,
        ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
      });
    }
    const pick = { ...pending(['forced-1', 'forced-2', 'plain'], 2), aggregateLevelMax: 10 };

    expect(maximumFeasiblePendingPickSelection(pick)).toEqual(['forced-1', 'plain']);
    expect(canApplyPendingPickSelection(pick, 'forced-2', ['forced-2', 'plain'])).toBe(true);
    resetCardRegistry();
  });
});
