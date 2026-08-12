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
import { areTerminalInteractionsBlocked } from '@/ui/services/terminalInteractionGate.js';
import type { GuardPickerCandidate } from '../components/GuardPickerModal.js';
import type { CutInDisguiseCandidate } from '../components/CutInDisguisePickerModal.js';

export type GuardPickerOpen = {
  actionId: string;
  candidates: readonly GuardPickerCandidate[];
  attackerName?: string;
  /**
   * engine mega-wave W2b (2026-07-03, r28): mustGuard 義務 (B09040 a2)。true のとき
   * candidates は義務 char のみに絞られており、「ガードしない」は封じる (engine passGuard
   * throw が backstop だが UI で pass を提示すると throw で UX 破綻するため事前抑止)。
   */
  mustGuard?: boolean;
};

export type CutInDisguisePickerOpen = {
  actionId: string;
  player: 'self' | 'opp';
  actorLabel: '1番目' | '2番目' | '1番目 (再行動)';
  // user_request 20260522_01 #7 (BUG-055): 1番目/2番目 だけでなく actor の
  // カード名を表示するため optional で渡す。useContactFlowDriver が
  // ownerOfUid → readDef 経由で解決する。
  actorName?: string;
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
  _setGuardPicker: (s) => {
    if (s !== null && areTerminalInteractionsBlocked()) return;
    set({ guardPicker: s });
  },
  _setCutInDisguise: (s) => {
    if (s !== null && areTerminalInteractionsBlocked()) return;
    set({ cutInDisguise: s });
  },
  _reset: () => set({ guardPicker: null, cutInDisguise: null }),
}));
