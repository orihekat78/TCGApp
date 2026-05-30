// 2026-05-28: useNextHintPicker hook tests
//
// rules: 12-next-hint.md
// spec: useConfirmation.test.ts と同型 (store + ask Promise)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useNextHintPicker,
  useNextHintPickerStore,
  type NextHintRequest,
} from '@/ui/hooks/useNextHintPicker';

const REQ: NextHintRequest = {
  fileTopCardId: 'D08017',
  fileTopName: '円谷光彦',
  candidates: [
    { cardId: 'D08017', source: 'file', name: '円谷光彦', level: 2, kind: 'character' },
  ],
  postPopCount: 2,
};

describe('useNextHintPicker', () => {
  beforeEach(() => {
    useNextHintPickerStore.getState()._reset();
  });

  it('ask は current を set し、acceptUse で {kind:use,cardId} resolve', async () => {
    const promise = useNextHintPicker().ask(REQ);
    expect(useNextHintPickerStore.getState().current).toEqual(REQ);

    useNextHintPicker().acceptUse('D08017');
    const choice = await promise;
    expect(choice).toEqual({ kind: 'use', cardId: 'D08017' });
    expect(useNextHintPickerStore.getState().current).toBeNull();
  });

  it('acceptSkip で {kind:skip} resolve', async () => {
    const promise = useNextHintPicker().ask(REQ);
    useNextHintPicker().acceptSkip();
    const choice = await promise;
    expect(choice).toEqual({ kind: 'skip' });
    expect(useNextHintPickerStore.getState().current).toBeNull();
  });

  it('acceptCancel で {kind:cancel} resolve', async () => {
    const promise = useNextHintPicker().ask(REQ);
    useNextHintPicker().acceptCancel();
    const choice = await promise;
    expect(choice).toEqual({ kind: 'cancel' });
    expect(useNextHintPickerStore.getState().current).toBeNull();
  });

  it('open 中に再 ask → 旧 Promise は cancel で resolve、新 current に差し替え', async () => {
    const first = useNextHintPicker().ask(REQ);
    const second = useNextHintPicker().ask({ ...REQ, fileTopName: '別カード' });
    // 旧 Promise は cancel
    expect(await first).toEqual({ kind: 'cancel' });
    expect(useNextHintPickerStore.getState().current?.fileTopName).toBe('別カード');
    // 新 Promise は acceptUse で解決
    useNextHintPicker().acceptUse('D08017');
    expect(await second).toEqual({ kind: 'use', cardId: 'D08017' });
  });

  it('idle 中の accept* は no-op (resolver 無し)', () => {
    // current=null の状態で呼んでも例外を投げない
    expect(() => useNextHintPicker().acceptSkip()).not.toThrow();
    expect(useNextHintPickerStore.getState().current).toBeNull();
  });
});
