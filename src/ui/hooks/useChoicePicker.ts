// BUG-108: choice effect (複数 option の択一、例 D11012 a1「LP＋1するか / AP＋2000する」) の
// option 選択 picker 用 store + Promise hook。
//
// rules: 15-abilities-effects.md (「〜するか〜する」= プレイヤーが択一)
// spec: useEvidenceFlipPicker / useNextHintPicker と同型 (store + ask Promise)
//
// 設計:
//   - 複数 option を持つ top-level choice effect を持つ declared ability で、どの option を
//     使うかを user に選ばせるための modal state を保持する。
//   - runDeclaredAbilityFlow が確認モーダル accept 後 (cost picker 後) に ask() → Promise を await。
//   - user が ChoicePickerModal で option を選択 → choose(index) で resolve、× / 背景で cancel。
//   - 選択 index は ctx.dyn.choiceIndex に積まれ、useDeclaredAbility → resolveEffectPicks の
//     choice unwrap (BUG-108) が「選択 option のみ」を解決する。
//   - 単一 option の choice (D11014 a2 step2 等) は flow 側で modal を出さない (choiceIndex=0 既定)。
//   - 既に open 中に再 ask が来たら旧 Promise を cancel resolve して新 modal を出す (同パターン)。

import { create } from 'zustand';
import { areTerminalInteractionsBlocked } from '@/ui/services/terminalInteractionGate.js';

/** 選択肢 1 件 = effect.options の index + 表示ラベル ("LP＋1" 等)。 */
export type ChoiceOption = {
  /** effect.options 配列の index (ctx.dyn.choiceIndex に積まれる) */
  index: number;
  /** 人間可読ラベル (verb + args から導出、choiceOptionLabel) */
  label: string;
};

export type ChoiceRequest = {
  /** 発動カード名 (banner 表示用) */
  sourceName: string;
  /** 選択肢一覧 (2 件以上) */
  options: ChoiceOption[];
};

/** picker の確定結果 */
export type ChoiceResult =
  | { kind: 'choose'; index: number } // 選択した option index
  | { kind: 'cancel' }; // 能力使用を取り消し

type Resolver = (choice: ChoiceResult) => void;

type ChoicePickerStore = {
  current: ChoiceRequest | null;
  _resolver: Resolver | null;
  _setCurrent: (req: ChoiceRequest | null) => void;
  _setResolver: (r: Resolver | null) => void;
  _reset: () => void;
};

export const useChoicePickerStore = create<ChoicePickerStore>((set) => ({
  current: null,
  _resolver: null,
  _setCurrent: (current) => set({ current }),
  _setResolver: (resolver) => set({ _resolver: resolver }),
  _reset: () => set({ current: null, _resolver: null }),
}));

export type ChoicePicker = {
  current: ChoiceRequest | null;
  ask: (req: ChoiceRequest) => Promise<ChoiceResult>;
  choose: (index: number) => void;
  cancel: () => void;
};

function askChoice(req: ChoiceRequest): Promise<ChoiceResult> {
  if (areTerminalInteractionsBlocked()) return Promise.resolve({ kind: 'cancel' });
  const store = useChoicePickerStore.getState();
  const prev = store._resolver;
  if (prev) prev({ kind: 'cancel' }); // open 中の旧 Promise を破棄

  return new Promise<ChoiceResult>((resolve) => {
    store._setResolver(resolve);
    store._setCurrent(req);
  });
}

function settle(choice: ChoiceResult): void {
  const store = useChoicePickerStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  if (resolver) resolver(choice);
}

export function cancelChoicePicker(): void {
  settle({ kind: 'cancel' });
}

export function useChoicePicker(): ChoicePicker {
  return {
    current: useChoicePickerStore.getState().current,
    ask: askChoice,
    choose: (index) => settle({ kind: 'choose', index }),
    cancel: cancelChoicePicker,
  };
}
