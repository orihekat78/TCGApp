// CARD PHASE step12 batch2 (2026-07-04): declareName verb (宣言能力 / カットイン)
// の宣言名入力 picker 用 store + Promise hook。
//
// rules: 15-abilities-effects.md (「〜する」=必須 / 「〜してもよい」=skip 可)
// spec: useChoicePicker / useEvidenceFlipPicker と同型 (store + ask Promise)
//
// 設計:
//   - declareName atom を effect に含む宣言能力で、宣言するカード名 (自由文字列) を user に
//     入力させるための modal state を保持する。
//   - 宣言能力とカットインの public flow が dispatch 前に ask() → Promise を await。
//   - user が DeclareCardNameModal で名前確定 → declare(name) で resolve、× 不可 (confirm 済のため
//     cancel は能力使用全体の取り消し)。「してもよい」句 (atom args.optional) のみ skip を許可。
//   - 確定名は AbilityCostParams.declaredName → ctx.dyn.declaredName → atomDeclareName が
//     ctx.declaredNames[bind] へ書く (供給チャネルは engine W6 step1 で配線済)。
//   - skip 時は declaredName 未供給 = atom が空文字 fallback → 消費側 (nameOverride /
//     boundNameMatchesDeclared) が no-op/false に落ちる (engine 設計済の decline 経路)。
//   - AI 経路は本 hook を通らず、constrained domain の登録名を決定的に供給。

import { create } from 'zustand';
import { areTerminalInteractionsBlocked } from '@/ui/services/terminalInteractionGate.js';
import type { DeclaredNameDomain } from '@/engine/types';

export type DeclareNameRequest = {
  /** 発動カード名 (banner 表示用) */
  sourceName: string;
  /** 能力テキスト該当句 (何のための宣言かを表示) */
  prompt: string;
  /** オートコンプリート候補 (登録済み CardDef 全名) */
  candidateNames: readonly string[];
  /** Engine-enforced declaration authority; omitted means legacy unrestricted. */
  domain?: DeclaredNameDomain;
  /** 「してもよい」系 = true (skip ボタンを出す)。「〜する」= false (確定のみ) */
  optional: boolean;
};

/** picker の確定結果 */
export type DeclareNameResult =
  | { kind: 'declare'; name: string } // 宣言名を確定
  | { kind: 'skip' } // 宣言しない (optional のみ)
  | { kind: 'cancel' }; // 能力使用を取り消し

type Resolver = (result: DeclareNameResult) => void;

type DeclareNamePickerStore = {
  current: DeclareNameRequest | null;
  _resolver: Resolver | null;
  _setCurrent: (req: DeclareNameRequest | null) => void;
  _setResolver: (r: Resolver | null) => void;
  _reset: () => void;
};

export const useDeclareNamePickerStore = create<DeclareNamePickerStore>((set) => ({
  current: null,
  _resolver: null,
  _setCurrent: (current) => set({ current }),
  _setResolver: (resolver) => set({ _resolver: resolver }),
  _reset: () => set({ current: null, _resolver: null }),
}));

export type DeclareNamePicker = {
  current: DeclareNameRequest | null;
  ask: (req: DeclareNameRequest) => Promise<DeclareNameResult>;
  declare: (name: string) => void;
  skip: () => void;
  cancel: () => void;
};

function askDeclareName(req: DeclareNameRequest): Promise<DeclareNameResult> {
  if (areTerminalInteractionsBlocked()) return Promise.resolve({ kind: 'cancel' });
  const store = useDeclareNamePickerStore.getState();
  const prev = store._resolver;
  if (prev) prev({ kind: 'cancel' }); // open 中の旧 Promise を破棄 (useChoicePicker 同パターン)

  return new Promise<DeclareNameResult>((resolve) => {
    store._setResolver(resolve);
    store._setCurrent(req);
  });
}

function settle(result: DeclareNameResult): void {
  const store = useDeclareNamePickerStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  if (resolver) resolver(result);
}

export function cancelDeclareNamePicker(): void {
  settle({ kind: 'cancel' });
}

export function useDeclareNamePicker(): DeclareNamePicker {
  return {
    current: useDeclareNamePickerStore.getState().current,
    ask: askDeclareName,
    declare: (name) => settle({ kind: 'declare', name }),
    skip: () => settle({ kind: 'skip' }),
    cancel: cancelDeclareNamePicker,
  };
}
