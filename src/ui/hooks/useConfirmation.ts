// Phase 8 Task 8.3: 厳格モード モーダル (Q9) 共通 hook
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
//   - 推理 / アクション / アシスト / 事件解決 / 手札使用 / ネクストヒント /
//     宣言能力 — すべて確認モーダルを介する
//   - アシスト・事件解決は強警告 / 勝利予告などの kind 差で UI 装飾を変える
//
// 設計 (useTargetPicker と同じパターン):
//   - 単一 modal を Zustand 別 store で保持
//   - ask(req) → Promise<boolean> を返す。consumer は await する
//   - 既に open 中に再 ask が来たら旧 Promise を false resolve して新 modal を出す
//   - accept/reject in idle は no-op
//   - useConfirmation() 自体は subscribe-free。再描画 subscribe は
//     `useConfirmationStore((s) => s.current)` を component で呼ぶ。

import { create } from 'zustand';

export type ConfirmKind = 'standard' | 'warning' | 'victory';

export type ConfirmRequest = {
  kind: ConfirmKind;
  title: string;
  body: string;
  /** OK ボタンラベル (default: '実行') */
  okLabel?: string;
  /** Cancel ボタンラベル (default: 'キャンセル') */
  cancelLabel?: string;
};

/** デフォルト値を埋めた最終 ConfirmRequest (UI に渡される形) */
export type ResolvedConfirmRequest = Required<ConfirmRequest>;

type Resolver = (accepted: boolean) => void;

type ConfirmStore = {
  current: ResolvedConfirmRequest | null;
  _resolver: Resolver | null;
  _setCurrent: (req: ResolvedConfirmRequest | null) => void;
  _setResolver: (r: Resolver | null) => void;
  _reset: () => void;
};

export const useConfirmationStore = create<ConfirmStore>((set) => ({
  current: null,
  _resolver: null,
  _setCurrent: (current) => set({ current }),
  _setResolver: (resolver) => set({ _resolver: resolver }),
  _reset: () => set({ current: null, _resolver: null }),
}));

export type Confirmation = {
  current: ResolvedConfirmRequest | null;
  ask: (req: ConfirmRequest) => Promise<boolean>;
  accept: () => void;
  reject: () => void;
};

function askConfirmation(req: ConfirmRequest): Promise<boolean> {
  const resolved: ResolvedConfirmRequest = {
    kind: req.kind,
    title: req.title,
    body: req.body,
    okLabel: req.okLabel ?? '実行',
    cancelLabel: req.cancelLabel ?? 'キャンセル',
  };

  const store = useConfirmationStore.getState();
  // 既に open 中の Promise があれば false で resolve して破棄
  const prev = store._resolver;
  if (prev) prev(false);

  return new Promise<boolean>((resolve) => {
    store._setResolver(resolve);
    store._setCurrent(resolved);
  });
}

function acceptConfirmation(): void {
  const store = useConfirmationStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  if (resolver) resolver(true);
}

function rejectConfirmation(): void {
  const store = useConfirmationStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  if (resolver) resolver(false);
}

/** React 外の対戦セッション管理から、保留確認を false で決着する。 */
export const rejectPendingConfirmation = rejectConfirmation;

/**
 * 利便ラッパ。React 外からも呼べる。component で current 変化に
 * 反応して再描画したい場合は `useConfirmationStore((s) => s.current)` を併用。
 */
export function useConfirmation(): Confirmation {
  return {
    current: useConfirmationStore.getState().current,
    ask: askConfirmation,
    accept: acceptConfirmation,
    reject: rejectConfirmation,
  };
}
