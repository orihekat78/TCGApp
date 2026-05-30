// 2026-05-28: ネクストヒント step2 (カード使用) picker 用 store + Promise hook
//
// rules: 12-next-hint.md (step1 FILE→手札 + step2 任意 1 枚使用)
// spec: useConfirmation と同型 (store + ask Promise パターン)
//
// 設計:
//   - 単一 modal を Zustand 別 store で保持
//   - ask(req) → Promise<NextHintChoice> を返す。consumer は await
//   - use: step1+step2 (選択カード使用) / skip: step1 のみ (引くだけ) / cancel: 何もしない
//   - 既に open 中に再 ask が来たら旧 Promise を cancel resolve して新 modal を出す
//   - useNextHintPicker() 自体は subscribe-free。再描画は
//     useNextHintPickerStore((s) => s.current) を component で呼ぶ

import { create } from 'zustand';

/** step2 候補カード 1 件 (FILE-top または使用可能な手札カード) */
export type NextHintCandidate = {
  cardId: string;
  /** 'file' = step1 で引く FILE 最上部カード / 'hand' = 既存の手札カード */
  source: 'file' | 'hand';
  name: string;
  level: number;
  kind: 'character' | 'event';
};

export type NextHintRequest = {
  /** step1 で手札に加わる FILE 最上部カードの cardId */
  fileTopCardId: string;
  /** FILE 最上部カードの表示名 (ヘッダ用) */
  fileTopName: string;
  /** step2 で使用可能な候補 (level ≤ postPopCount かつ色一致でフィルタ済) */
  candidates: NextHintCandidate[];
  /**
   * 2026-05-30: step1 で 1 枚引いた後の実効 FILE 枚数 (= 使用可能レベル上限)。
   * picker キャプションに「レベル N 以下」と明示し、FILE-1 の暗算を不要にする。
   */
  postPopCount: number;
};

/** picker の確定結果 */
export type NextHintChoice =
  | { kind: 'use'; cardId: string } // step1 + step2 (カード使用)
  | { kind: 'skip' }                // step1 のみ (FILE→手札、使用しない)
  | { kind: 'cancel' };             // 何もしない (NH 自体を取り消し)

type Resolver = (choice: NextHintChoice) => void;

type NextHintPickerStore = {
  current: NextHintRequest | null;
  _resolver: Resolver | null;
  _setCurrent: (req: NextHintRequest | null) => void;
  _setResolver: (r: Resolver | null) => void;
  _reset: () => void;
};

export const useNextHintPickerStore = create<NextHintPickerStore>((set) => ({
  current: null,
  _resolver: null,
  _setCurrent: (current) => set({ current }),
  _setResolver: (resolver) => set({ _resolver: resolver }),
  _reset: () => set({ current: null, _resolver: null }),
}));

export type NextHintPicker = {
  current: NextHintRequest | null;
  ask: (req: NextHintRequest) => Promise<NextHintChoice>;
  acceptUse: (cardId: string) => void;
  acceptSkip: () => void;
  acceptCancel: () => void;
};

function askNextHint(req: NextHintRequest): Promise<NextHintChoice> {
  const store = useNextHintPickerStore.getState();
  // 既に open 中の Promise があれば cancel で resolve して破棄
  const prev = store._resolver;
  if (prev) prev({ kind: 'cancel' });

  return new Promise<NextHintChoice>((resolve) => {
    store._setResolver(resolve);
    store._setCurrent(req);
  });
}

function settle(choice: NextHintChoice): void {
  const store = useNextHintPickerStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  if (resolver) resolver(choice);
}

/**
 * 利便ラッパ。React 外からも呼べる。component で current 変化に
 * 反応して再描画したい場合は useNextHintPickerStore((s) => s.current) を併用。
 */
export function useNextHintPicker(): NextHintPicker {
  return {
    current: useNextHintPickerStore.getState().current,
    ask: askNextHint,
    acceptUse: (cardId) => settle({ kind: 'use', cardId }),
    acceptSkip: () => settle({ kind: 'skip' }),
    acceptCancel: () => settle({ kind: 'cancel' }),
  };
}
