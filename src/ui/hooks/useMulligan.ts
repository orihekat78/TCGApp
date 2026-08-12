// Round 2 (Phase 5 advance) — マリガン UI Promise-based prompt
//
// 役割: ゲーム開始時の手札引き直し (rules/04 §5) UI を Promise/Zustand で駆動する。
//
// spec: .claude/specs/2026-05-11-ui-game-setup-flows.md §マリガン
//
// 設計 (useConfirmation / useTargetPicker と同パターン):
//   - 単一 modal を Zustand store で保持
//   - prompt(player, hand) → Promise<string[]> を返す。consumer は await する
//   - resolve は idsToReturn (空配列ならマリガンしない = 0 枚返却で消費)
//   - 同時に複数 prompt は出ない設計 (先攻 → 後攻 を gameStarter で順次 await)
//
// 注: rules/04 「先攻プレイヤーが先に決定」を実装で保証する責務は gameStarter 側。

import { create } from 'zustand';
import type { CardId } from '@/engine/types';
import { areTerminalInteractionsBlocked } from '@/ui/services/terminalInteractionGate.js';

type Player = 'self' | 'opp';

export type MulliganRequest = {
  player: Player;
  /**
   * 表示用の手札カード ID 列。順序は engine の手札順 (左から右へ)。
   * Modal は cardResolvers 経由で表示名・画像を解決する。
   */
  hand: ReadonlyArray<CardId>;
};

type Resolver = (idsToReturn: ReadonlyArray<CardId>) => void;

type MulliganStore = {
  current: MulliganRequest | null;
  _resolver: Resolver | null;
  _setCurrent: (req: MulliganRequest | null) => void;
  _setResolver: (r: Resolver | null) => void;
  _reset: () => void;
};

export const useMulliganStore = create<MulliganStore>((set) => ({
  current: null,
  _resolver: null,
  _setCurrent: (current) => set({ current }),
  _setResolver: (resolver) => set({ _resolver: resolver }),
  _reset: () => set({ current: null, _resolver: null }),
}));

/**
 * マリガン UI を起動し、ユーザの選択 (戻すカード ID リスト) を Promise で返す。
 * 空配列 = マリガンしない (engine.flow.setup.mulligan は []で呼ぶ = 権利消費のみ)。
 */
export function promptMulligan(req: MulliganRequest): Promise<ReadonlyArray<CardId>> {
  if (areTerminalInteractionsBlocked()) return Promise.resolve([]);
  const store = useMulliganStore.getState();
  // 既存 prompt があれば空配列で resolve して上書き (理論上発生しないが安全側)
  const prev = store._resolver;
  if (prev) prev([]);

  return new Promise<ReadonlyArray<CardId>>((resolve) => {
    store._setResolver(resolve);
    store._setCurrent(req);
  });
}

/**
 * Modal からの「戻すカード確定 → シャッフル & 引き直し」アクション。
 * @param idsToReturn 戻すカードの cardId 配列 (空 = マリガンしない)
 */
export function resolveMulligan(idsToReturn: ReadonlyArray<CardId>): void {
  const store = useMulliganStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  if (resolver) resolver(idsToReturn);
}

/** テスト用: store 全クリア */
export function _resetMulliganStore(): void {
  useMulliganStore.getState()._reset();
}
