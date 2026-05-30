// BUG-085: useEvidenceFlipPicker store + Promise hook の単体テスト
//
// rules: 21-declared-ability-cost.md
// spec: useNextHintPicker.test.ts と同型 (ask → confirm/cancel で resolve)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useEvidenceFlipPicker,
  useEvidenceFlipPickerStore,
  type EvidenceFlipRequest,
} from '@/ui/hooks/useEvidenceFlipPicker';

const REQ: EvidenceFlipRequest = {
  side: 'self',
  sourceName: '青の古城探索事件',
  candidates: [
    { index: 0, cardId: 'A' },
    { index: 1, cardId: 'B' },
    { index: 2, cardId: 'C' },
  ],
  nMin: 1,
  nMax: Infinity,
};

beforeEach(() => {
  useEvidenceFlipPickerStore.getState()._reset();
});

describe('useEvidenceFlipPicker', () => {
  it('ask() で current が set される', () => {
    void useEvidenceFlipPicker().ask(REQ);
    const cur = useEvidenceFlipPickerStore.getState().current;
    expect(cur).not.toBeNull();
    expect(cur?.sourceName).toBe('青の古城探索事件');
    expect(cur?.candidates.length).toBe(3);
    expect(cur?.nMax).toBe(Infinity);
  });

  it('confirm(indices) で Promise が confirm choice で resolve + current クリア', async () => {
    const p = useEvidenceFlipPicker().ask(REQ);
    useEvidenceFlipPicker().confirm([0, 2]);
    const choice = await p;
    expect(choice).toEqual({ kind: 'confirm', indices: [0, 2] });
    expect(useEvidenceFlipPickerStore.getState().current).toBeNull();
  });

  it('cancel() で Promise が cancel choice で resolve + current クリア', async () => {
    const p = useEvidenceFlipPicker().ask(REQ);
    useEvidenceFlipPicker().cancel();
    const choice = await p;
    expect(choice).toEqual({ kind: 'cancel' });
    expect(useEvidenceFlipPickerStore.getState().current).toBeNull();
  });

  it('open 中に再 ask すると旧 Promise が cancel で resolve される', async () => {
    const p1 = useEvidenceFlipPicker().ask(REQ);
    const p2 = useEvidenceFlipPicker().ask({ ...REQ, sourceName: '別事件' });
    const c1 = await p1;
    expect(c1).toEqual({ kind: 'cancel' });
    // 新しい current は別事件
    expect(useEvidenceFlipPickerStore.getState().current?.sourceName).toBe('別事件');
    useEvidenceFlipPicker().confirm([1]);
    expect(await p2).toEqual({ kind: 'confirm', indices: [1] });
  });

  it('current=null で settle しても no-op (resolver 二重発火しない)', () => {
    // current が無い状態で confirm を呼んでも例外なく何も起きない
    expect(() => useEvidenceFlipPicker().confirm([0])).not.toThrow();
    expect(useEvidenceFlipPickerStore.getState().current).toBeNull();
  });
});
