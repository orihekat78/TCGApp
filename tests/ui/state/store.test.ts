// tests/ui/state/store.test.ts — Phase 7 Task 7.1 tests
// 規約: store は GameState の受動的ホルダ + dispatcher
// 仕様:
//  - 初期 gameState は null（ゲーム未ロード）
//  - setGameState(s) で全置換
//  - dispatch(mutator) で mutator の戻り値に置換（null のときは no-op、mutator も呼ばれない）
//  - subscribe で変更通知が届く

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types/game-state';

describe('useGameStateStore', () => {
  beforeEach(() => {
    // 各テスト前に state を null にリセット
    useGameStateStore.setState({ gameState: null });
  });

  it('initial gameState is null (no game loaded)', () => {
    // 初期化直後（reset）に null であることを確認
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('setGameState replaces the whole state', () => {
    const initial: GameState = createEmptyGameState();
    useGameStateStore.getState().setGameState(initial);
    expect(useGameStateStore.getState().gameState).toBe(initial);

    // 別の state で置き換えると入れ替わる
    const replacement: GameState = createEmptyGameState();
    useGameStateStore.getState().setGameState(replacement);
    expect(useGameStateStore.getState().gameState).toBe(replacement);
    expect(useGameStateStore.getState().gameState).not.toBe(initial);
  });

  it('dispatch(mutator) applies the mutator and stores its return value', () => {
    const initial: GameState = createEmptyGameState();
    useGameStateStore.getState().setGameState(initial);

    const mutator = (s: GameState): GameState => ({
      ...s,
      turn: { ...s.turn, number: s.turn.number + 1 },
    });

    useGameStateStore.getState().dispatch(mutator);

    const after = useGameStateStore.getState().gameState;
    expect(after).not.toBeNull();
    expect(after).not.toBe(initial); // 新しい参照
    expect(after!.turn.number).toBe(initial.turn.number + 1);
    // 関係ないフィールドは保持
    expect(after!.turn.player).toBe(initial.turn.player);
  });

  it('dispatch on null state is a no-op (mutator NOT called)', () => {
    // 前提: gameState が null
    expect(useGameStateStore.getState().gameState).toBeNull();

    const mutator = vi.fn((s: GameState) => s);
    useGameStateStore.getState().dispatch(mutator);

    expect(mutator).not.toHaveBeenCalled();
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('subscribers fire on setGameState and dispatch', () => {
    const listener = vi.fn();
    const unsubscribe = useGameStateStore.subscribe(listener);

    try {
      const s1 = createEmptyGameState();
      useGameStateStore.getState().setGameState(s1);
      expect(listener).toHaveBeenCalledTimes(1);

      useGameStateStore
        .getState()
        .dispatch((s) => ({ ...s, turn: { ...s.turn, number: s.turn.number + 1 } }));
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
    }
  });
});
