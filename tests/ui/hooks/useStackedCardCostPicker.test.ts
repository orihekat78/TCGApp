import { beforeEach, describe, expect, it } from 'vitest';
import {
  useStackedCardCostPicker,
  useStackedCardCostPickerStore,
  type StackedCardCostRequest,
} from '@/ui/hooks/useStackedCardCostPicker';

const request: StackedCardCostRequest = {
  sourceName: '阿笠博士',
  candidates: [{ instanceId: 'a', cardId: 'A' }, { instanceId: 'b', cardId: 'B' }],
  nMin: 1,
  nMax: 1,
};

beforeEach(() => {
  useStackedCardCostPickerStore.setState({ current: null, _resolver: null });
});

describe('useStackedCardCostPicker', () => {
  it('keeps occurrence identities through confirm', async () => {
    const pending = useStackedCardCostPicker().ask(request);
    expect(useStackedCardCostPickerStore.getState().current?.candidates[1]?.instanceId).toBe('b');
    useStackedCardCostPicker().confirm(['b']);
    expect(await pending).toEqual({ kind: 'confirm', instanceIds: ['b'] });
    expect(useStackedCardCostPickerStore.getState().current).toBeNull();
  });

  it('cancels the previous request before replacing it', async () => {
    const first = useStackedCardCostPicker().ask(request);
    const second = useStackedCardCostPicker().ask({ ...request, sourceName: '新規' });
    expect(await first).toEqual({ kind: 'cancel' });
    useStackedCardCostPicker().cancel();
    expect(await second).toEqual({ kind: 'cancel' });
  });
});
