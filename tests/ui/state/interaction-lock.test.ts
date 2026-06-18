// tests/ui/state/interaction-lock — 効果解決中の入力ロック判定 (rules/05 割り込み禁止 / rules/15 未解決効果)
// selectInteractionLocked: 効果スタック非空 or 人間の未解決 decision (pick/choice/optional/hirameki/misread/deck-reveal)
// が1つでもあれば true。必要な decision modal 自体はロック対象外 (この flag は ActionsPanel の main action 起点を塞ぐ用)。
import { describe, it, expect } from 'vitest';
import { selectInteractionLocked } from '@/ui/state/interactionLock';
import type { GameState } from '@/engine/types/game-state';

type Slice = Parameters<typeof selectInteractionLocked>[0];

function base(over: Partial<Slice> = {}): Slice {
  return {
    gameState: { pendingEffects: [] } as unknown as GameState,
    pendingEffectPick: null,
    pendingEffectChoice: null,
    pendingEffectOptional: null,
    pendingHirameki: null,
    pendingMisread: null,
    pendingDeckReveal: null,
    ...over,
  };
}

describe('selectInteractionLocked', () => {
  it('効果なし・decision なし → ロックしない', () => {
    expect(selectInteractionLocked(base())).toBe(false);
  });

  it('gameState=null (未ロード) → ロックしない', () => {
    expect(selectInteractionLocked(base({ gameState: null }))).toBe(false);
  });

  it('pendingEffects が1件以上 → ロック (効果解決中)', () => {
    const gs = { pendingEffects: [{ id: 'e1' }] } as unknown as GameState;
    expect(selectInteractionLocked(base({ gameState: gs }))).toBe(true);
  });

  it('各 decision 待ち (pick/choice/optional/hirameki/misread/deck-reveal) で個別にロック', () => {
    const keys: (keyof Slice)[] = [
      'pendingEffectPick', 'pendingEffectChoice', 'pendingEffectOptional',
      'pendingHirameki', 'pendingMisread', 'pendingDeckReveal',
    ];
    for (const k of keys) {
      expect(selectInteractionLocked(base({ [k]: {} as never }))).toBe(true);
    }
  });
});
