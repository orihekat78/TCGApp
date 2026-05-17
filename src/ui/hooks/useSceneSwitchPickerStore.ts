// Phase 5 advance — SceneSwitch UI: picker open 状態 store
//
// rules: 20-color-and-switch.md §スイッチ
//
// 役割:
//   - scene 5 枚埋まり時のキャラ手札使用 (canHandUseCardSwitch=true) で、
//     リムーブ対象 uid を user に選ばせるための modal state を保持する
//   - runHandUseFlow が `_open` してから Promise を待機 → user pick or cancel で resolve
//   - Playmat 側 wrapper (PlaymatSceneSwitchPickerModal) が subscribe して描画
//
// 設計判断:
//   - useContactModalStore と分離。contact-flow と hand-use-flow は別 domain
//   - Promise resolver 経路 — useContactModalStore の useEffect 駆動とは違って
//     handUseFlow は単一 await で完結するため Promise の方が自然
//   - resolve(uid) で commit / resolve(null) で cancel

import { create } from 'zustand';
import type { SceneSwitchCharView } from '../components/SceneSwitchPickerModal.js';

export type SceneSwitchPickerOpen = {
  cardId: string;
  newCardName: string;
  candidates: readonly SceneSwitchCharView[];
  /** user pick → uid / cancel → null */
  resolve: (removeUid: string | null) => void;
};

export type SceneSwitchPickerStore = {
  current: SceneSwitchPickerOpen | null;
  _open: (o: SceneSwitchPickerOpen) => void;
  _close: () => void;
};

export const useSceneSwitchPickerStore = create<SceneSwitchPickerStore>((set) => ({
  current: null,
  _open: (o) => set({ current: o }),
  _close: () => set({ current: null }),
}));
