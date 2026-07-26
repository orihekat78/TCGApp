import { beforeEach, describe, expect, it } from 'vitest';
import { cancelHandCostPicker, useHandCostPicker, useHandCostPickerStore } from '@/ui/hooks/useHandCostPicker';

const request = {
  side: 'self' as const, sourceName: 'B10100', n: 1,
  candidates: [{ index: 0, cardId: 'DUP' }, { index: 2, cardId: 'DUP' }],
};

describe('useHandCostPicker', () => {
  beforeEach(() => useHandCostPickerStore.getState()._reset());

  it('preserves duplicate-card occurrence indices through confirm', async () => {
    const pending = useHandCostPicker().ask(request);
    expect(useHandCostPickerStore.getState().current?.candidates.map(candidate => candidate.index)).toEqual([0, 2]);
    useHandCostPicker().confirm([2]);
    expect(await pending).toEqual({ kind: 'confirm', indices: [2] });
    expect(useHandCostPickerStore.getState().current).toBeNull();
  });

  it('cancels an outstanding selection', async () => {
    const pending = useHandCostPicker().ask(request);
    cancelHandCostPicker();
    expect(await pending).toEqual({ kind: 'cancel' });
  });
});
