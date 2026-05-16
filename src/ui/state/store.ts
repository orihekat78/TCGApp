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
  /**
   * Phase 8 完全クローズ Commit 2: 進行中の ActionContext.id を保持。
   * - actionDeclareChar/Case dispatch 直後にセット
   * - useContactFlowDriver が監視し phase ごとにモーダル open / AI 自動進行
   * - phase='action-end' に到達したら driver が null にクリア
   * GameState には積まない理由は src/engine/flow/action/state-machine.ts の冒頭コメント参照。
   */
  activeActionId: string | null;
  setActiveActionId: (id: string | null) => void;
  /**
   * Phase 8 完全クローズ Commit 3a: アクション[事件] による証拠リムーブで
   * ヒラメキ能力が検出された時の保留状態。
   * - engine listener (`src/engine/listeners/hirameki.ts`) が
   *   `evidence:remove-by-action` 発火で側チャネル経由で set
   * - useHiramekiFlowDriver が監視し、self owner ならモーダル / opp owner なら AI 自動
   * - `hiramekiResolve` dispatch で fire/skip 決定 → クリア
   */
  pendingHirameki: PendingHirameki | null;
  setPendingHirameki: (p: PendingHirameki | null) => void;
};

/** ヒラメキ保留 (Commit 3a) */
export type PendingHirameki = {
  /** 証拠の所有者 = ヒラメキ発動権利者 */
  player: 'self' | 'opp';
  /** 元証拠カードの cardId */
  cardId: string;
  /** 発動対象 ability id */
  abilityId: string;
};

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  gameState: null,
  setGameState: (state) => set({ gameState: state }),
  dispatch: (mutator) => {
    const current = get().gameState;
    if (current === null) return;
    set({ gameState: mutator(current) });
  },
  activeActionId: null,
  setActiveActionId: (id) => set({ activeActionId: id }),
  pendingHirameki: null,
  setPendingHirameki: (p) => set({ pendingHirameki: p }),
}));
