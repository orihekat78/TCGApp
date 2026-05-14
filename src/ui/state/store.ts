// src/ui/state/store.ts — Phase 7 Task 7.1
// 役割: GameState の受動的ホルダ + dispatcher（mutator を実行して結果を保持）
//
// 設計方針（plan / 骨格凍結原則準拠）:
//  - store はドメイン知識を持たない。UI イベント→engine mutation の seam に徹する
//  - mutator は呼び出し側が engine API から合成する純粋関数 (s: GameState) => GameState
//  - 状態 mutation は engine が immutable に管理するため、store では immer を使わない
//  - gameState=null はゲーム未ロードを表す。dispatch は null のとき no-op

import { create } from 'zustand';
import type { GameState } from '@/engine/types/game-state';

export type GameStateMutator = (state: GameState) => GameState;

export type GameStateStore = {
  /** 現在のゲーム状態。未ロード時は null。 */
  gameState: GameState | null;
  /** state を全置換する（ゲーム開始 / リセット / リプレイ読み込み用） */
  setGameState: (state: GameState) => void;
  /**
   * 現在の gameState に mutator を適用し、その戻り値で置き換える。
   * gameState が null の場合は何もしない（mutator も呼ばれない）。
   */
  dispatch: (mutator: GameStateMutator) => void;
};

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  gameState: null,
  setGameState: (state) => set({ gameState: state }),
  dispatch: (mutator) => {
    const current = get().gameState;
    if (current === null) return;
    set({ gameState: mutator(current) });
  },
}));
