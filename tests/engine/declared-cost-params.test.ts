import { describe, expect, it } from 'vitest';
import { declaredCostParamsToDyn } from '@/engine/flow/main/declared-cost-params';
import type { AbilityCostParams } from '@/engine/flow/main/ability-activate';

describe('declaredCostParamsToDyn', () => {
  it('preserves an explicitly supplied malformed removeSetCard witness for the shared fail-closed reader', () => {
    const params = { removeSetCard: undefined } as unknown as AbilityCostParams;

    expect(declaredCostParamsToDyn(params)).toEqual({
      costParams: { removeSetCard: undefined },
    });
  });

  it('puts every public cost channel and effect choice channel in its canonical dyn slot', () => {
    const params: AbilityCostParams = {
      flipFaceUpEvidence: { indices: [0] },
      sceneToDeckBottom: { uids: ['scene:1'] },
      removeAreaToDeckBottom: { ids: ['R1'] },
      partnerAreaRemove: { ids: ['P1'] },
      removeSetCard: { hostUids: ['host:1'], instanceIds: ['set:1'] },
      removeStackedCards: { instanceIds: ['stack:1'] },
      costChoice: 1,
      choiceIndex: 2,
      declaredName: '  江戸川コナン  ',
    };

    expect(declaredCostParamsToDyn(params)).toEqual({
      costParams: {
        flipFaceUpEvidence: { indices: [0] },
        sceneToDeckBottom: { uids: ['scene:1'] },
        removeAreaToDeckBottom: { ids: ['R1'] },
        partnerAreaRemove: { ids: ['P1'] },
        removeSetCard: { hostUids: ['host:1'], instanceIds: ['set:1'] },
        removeStackedCards: { instanceIds: ['stack:1'] },
      },
      costChoice: 1,
      choiceIndex: 2,
      declaredName: '江戸川コナン',
    });
  });
});
