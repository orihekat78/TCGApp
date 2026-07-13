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
    pendingEffectRepeatOptional: null,
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

  // BUG-173 (2026-07-04): pendingEffects は resolved/cancelled を prune しない累積配列 (BUG-151 規約)
  // → 判定は pending|resolving の state フィルタ。旧 length>0 判定は効果解決後の永久ロックだった。
  it('pending / resolving entry がある → ロック (効果解決中)', () => {
    for (const state of ['pending', 'resolving'] as const) {
      const gs = { pendingEffects: [{ id: 'e1', state }] } as unknown as GameState;
      expect(selectInteractionLocked(base({ gameState: gs })), state).toBe(true);
    }
  });

  it('resolved / cancelled 残留 entry のみ → ロックしない (BUG-173)', () => {
    const gs = {
      pendingEffects: [{ id: 'e1', state: 'resolved' }, { id: 'e2', state: 'cancelled' }],
    } as unknown as GameState;
    expect(selectInteractionLocked(base({ gameState: gs }))).toBe(false);
  });

  it('各 decision 待ち (pick/choice/optional/hirameki/misread/deck-reveal) で個別にロック', () => {
    const keys: (keyof Slice)[] = [
      'pendingEffectPick', 'pendingEffectChoice', 'pendingEffectOptional', 'pendingEffectRepeatOptional',
      'pendingHirameki', 'pendingMisread', 'pendingDeckReveal',
    ];
    for (const k of keys) {
      expect(selectInteractionLocked(base({ [k]: {} as never }))).toBe(true);
    }
  });
});
