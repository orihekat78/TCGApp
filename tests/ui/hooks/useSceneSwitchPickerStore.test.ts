// tests/ui/hooks/useSceneSwitchPickerStore.test.ts — Phase 5 advance SceneSwitch UI store

import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore.js';
import type { SceneSwitchPickerOpen } from '@/ui/hooks/useSceneSwitchPickerStore.js';

function makeOpen(overrides: Partial<SceneSwitchPickerOpen> = {}): SceneSwitchPickerOpen {
  return {
    player: 'self',
    cardId: 'D08003',
    newCardName: '江戸川コナン',
    candidates: [],
    resolve: () => {},
    ...overrides,
  };
}

describe('useSceneSwitchPickerStore', () => {
  beforeEach(() => {
    useSceneSwitchPickerStore.getState()._close();
  });

  it('初期状態は current=null', () => {
    expect(useSceneSwitchPickerStore.getState().current).toBeNull();
  });

  it('_open(o) で current が指定値に更新される', () => {
    const open = makeOpen({ cardId: 'D11004', newCardName: '萩原千速' });
    useSceneSwitchPickerStore.getState()._open(open);
    const cur = useSceneSwitchPickerStore.getState().current;
    expect(cur).not.toBeNull();
    expect(cur!.cardId).toBe('D11004');
    expect(cur!.newCardName).toBe('萩原千速');
  });

  it('_close() で current が null に戻る', () => {
    useSceneSwitchPickerStore.getState()._open(makeOpen());
    expect(useSceneSwitchPickerStore.getState().current).not.toBeNull();
    useSceneSwitchPickerStore.getState()._close();
    expect(useSceneSwitchPickerStore.getState().current).toBeNull();
  });

  it('candidates を配列で保持する', () => {
    const candidates = [
      { uid: 'u1', cardId: 'C1', name: 'C1', state: 'active' as const, isNamed: false },
      { uid: 'u2', cardId: 'C2', name: 'C2', state: 'sleep' as const, isNamed: true },
    ];
    useSceneSwitchPickerStore.getState()._open(makeOpen({ candidates }));
    const cur = useSceneSwitchPickerStore.getState().current;
    expect(cur!.candidates).toHaveLength(2);
    expect(cur!.candidates[0].uid).toBe('u1');
    expect(cur!.candidates[1].isNamed).toBe(true);
  });

  it('resolve callback が保持されて呼び出せる', () => {
    let received: string | null | undefined = undefined;
    const resolve = (uid: string | null): void => {
      received = uid;
    };
    useSceneSwitchPickerStore.getState()._open(makeOpen({ resolve }));
    const cur = useSceneSwitchPickerStore.getState().current!;
    cur.resolve('test-uid');
    expect(received).toBe('test-uid');
    cur.resolve(null);
    expect(received).toBeNull();
  });
});
