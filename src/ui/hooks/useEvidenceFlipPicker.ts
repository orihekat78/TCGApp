// 2026-05-30 BUG-085: 宣言能力コスト〚裏向きの証拠を1つ以上表向きにする〛の
// 証拠選択 picker 用 store + Promise hook
//
// rules: 21-declared-ability-cost.md (コストは「すべて行う」/ 一部不可なら使用不可)
//        01-victory-conditions.md (証拠エリア)
// spec: useNextHintPicker / useSceneSwitchPickerStore と同型 (store + ask Promise)
//
// 設計:
//   - flipFaceUpEvidence コスト (D08026 / D11021 / D08005) を持つ declared ability で、
//     どの「裏向き証拠」を表向きにするかを user に選ばせるための modal state を保持する。
//   - runDeclaredAbilityFlow が確認モーダル accept 後に ask() → Promise を await。
//   - user が CardListModal (証拠エリア拡大表示の流用) で証拠を選択 → confirm(indices)
//     で resolve / × or 背景クリックで cancel。
//   - Playmat 側 wrapper が current を subscribe して CardListModal を pick mode で開く。
//   - 既に open 中に再 ask が来たら旧 Promise を cancel resolve して新 modal を出す
//     (useNextHintPicker と同パターン)。

import { create } from 'zustand';

/** 表向きにできる候補 = 自分の裏向き証拠 1 件 (evidence 配列 index + cardId)。 */
export type EvidenceFlipCandidate = {
  /** state.players[side].evidence の配列 index (cost.pay の flipFaceUp が使う) */
  index: number;
  /** 証拠カードの cardId (裏向き表示だが pickCands に必要) */
  cardId: string;
};

export type EvidenceFlipRequest = {
  /** コスト所有プレイヤー (証拠を表向きにする側) */
  side: 'self' | 'opp';
  /** 発動カード名 (banner 表示用) */
  sourceName: string;
  /** 表向きにできる裏向き証拠の候補 */
  candidates: EvidenceFlipCandidate[];
  /** 最低枚数 (>= 1) */
  nMin: number;
  /** 最大枚数 (Infinity の場合あり) */
  nMax: number;
};

/** picker の確定結果 */
export type EvidenceFlipChoice =
  | { kind: 'confirm'; indices: number[] } // 表向きにする証拠 index
  | { kind: 'cancel' }; // コスト未確定 → 能力使用を取り消し

type Resolver = (choice: EvidenceFlipChoice) => void;

type EvidenceFlipPickerStore = {
  current: EvidenceFlipRequest | null;
  _resolver: Resolver | null;
  _setCurrent: (req: EvidenceFlipRequest | null) => void;
  _setResolver: (r: Resolver | null) => void;
  _reset: () => void;
};

export const useEvidenceFlipPickerStore = create<EvidenceFlipPickerStore>((set) => ({
  current: null,
  _resolver: null,
  _setCurrent: (current) => set({ current }),
  _setResolver: (resolver) => set({ _resolver: resolver }),
  _reset: () => set({ current: null, _resolver: null }),
}));

export type EvidenceFlipPicker = {
  current: EvidenceFlipRequest | null;
  ask: (req: EvidenceFlipRequest) => Promise<EvidenceFlipChoice>;
  confirm: (indices: number[]) => void;
  cancel: () => void;
};

function askEvidenceFlip(req: EvidenceFlipRequest): Promise<EvidenceFlipChoice> {
  const store = useEvidenceFlipPickerStore.getState();
  // 既に open 中の Promise があれば cancel で resolve して破棄
  const prev = store._resolver;
  if (prev) prev({ kind: 'cancel' });

  return new Promise<EvidenceFlipChoice>((resolve) => {
    store._setResolver(resolve);
    store._setCurrent(req);
  });
}

function settle(choice: EvidenceFlipChoice): void {
  const store = useEvidenceFlipPickerStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  if (resolver) resolver(choice);
}

export function cancelEvidenceFlipPicker(): void {
  settle({ kind: 'cancel' });
}

/**
 * 利便ラッパ。React 外からも呼べる。component で current 変化に反応して再描画したい
 * 場合は useEvidenceFlipPickerStore((s) => s.current) を併用する。
 */
export function useEvidenceFlipPicker(): EvidenceFlipPicker {
  return {
    current: useEvidenceFlipPickerStore.getState().current,
    ask: askEvidenceFlip,
    confirm: (indices) => settle({ kind: 'confirm', indices }),
    cancel: cancelEvidenceFlipPicker,
  };
}
