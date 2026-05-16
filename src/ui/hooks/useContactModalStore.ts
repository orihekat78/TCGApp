// Phase 8 完全クローズ Commit 2: コンタクトフロー用モーダル状態 store
//
// rules: 07-action-flow.md / 08-contact.md / 09-cutin-disguise.md
// spec: 計画 — Per-Step Action Dispatch + ContactFlowDriver
//
// 役割:
//   - useContactFlowDriver が phase ごとにモーダル open を判定
//   - 本 store にモーダル「開いて」「閉じる」の状態を持ち、Playmat 側 host が描画
//   - ボタン押下は直接 dispatchEngineAction を呼ぶ (Promise resolver パターンより
//     React useEffect 駆動の単一 step ドライバと相性が良い)

import { create } from 'zustand';
import type { GuardPickerCandidate } from '../components/GuardPickerModal.js';
import type { CutInDisguiseCandidate } from '../components/CutInDisguisePickerModal.js';

export type GuardPickerOpen = {
  actionId: string;
  candidates: readonly GuardPickerCandidate[];
  attackerName?: string;
};

export type CutInDisguisePickerOpen = {
  actionId: string;
  player: 'self' | 'opp';
  actorLabel: '1番目' | '2番目' | '1番目 (再行動)';
  candidates: readonly CutInDisguiseCandidate[];
};

export type ContactModalStore = {
  guardPicker: GuardPickerOpen | null;
  cutInDisguise: CutInDisguisePickerOpen | null;
  _setGuardPicker: (s: GuardPickerOpen | null) => void;
  _setCutInDisguise: (s: CutInDisguisePickerOpen | null) => void;
  _reset: () => void;
};

export const useContactModalStore = create<ContactModalStore>((set) => ({
  guardPicker: null,
  cutInDisguise: null,
  _setGuardPicker: (s) => set({ guardPicker: s }),
  _setCutInDisguise: (s) => set({ cutInDisguise: s }),
  _reset: () => set({ guardPicker: null, cutInDisguise: null }),
}));
