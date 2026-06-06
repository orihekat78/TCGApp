// spec: .claude/specs/meta-ui/04-state-stores.md
// metaStore — UI 設定 (theme / speed / density / spectatorAi)
// persist namespace: conan.meta.v1.settings

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'noir' | 'crimson';
export type DensityName = 'compact' | 'comfortable';

export type CardBackId = 'gold' | 'azure' | 'crimson' | 'jade' | 'noir';

export interface Settings {
  theme: ThemeName;
  speed: number;
  density: DensityName;
  spectatorAi: number;
  // Phase 12-B: お気に入りカード番号一覧 (CardsScreen で ★ 表示)
  favorites: string[];
  // Phase 14-E: カード裏柄 (SettingsScreen で選択、SET 演出で利用 — 現状表示のみ)
  cardBack: CardBackId;
  // Phase 14-E: 音声 (将来 BGM/SE 実装時に参照)
  bgmVolume: number;
  seEnabled: boolean;
  // Phase 15-A: チュートリアル完了済ステップ ID 一覧 ('ch1-1', 'ch4-3' 等)
  tutorialClearedStepIds: string[];
}

export interface MatchMeta {
  mode: 'solo' | 'observe';
  selfDeckName: string;
  oppDeckName: string;
}

interface MetaState {
  settings: Settings;
  _hasHydrated: boolean;
  // Phase 15-A: 練習試合起動時にセット、ResultScreen 解決後に consume してクリア (transient、persist しない)
  _pendingPracticeChapter: number | null;
  // Phase 18: 対戦開始時 (SetupScreen) にセット、ResultScreen が MatchRecord 構築時に consume (transient)
  _matchMeta: MatchMeta | null;
  setMatchMeta: (m: MatchMeta) => void;
  consumeMatchMeta: () => MatchMeta | null;
  setSettings: (patch: Partial<Settings>) => void;
  toggleFavorite: (cardNum: string) => void;
  isFavorited: (cardNum: string) => boolean;
  // Phase 15-A: チュートリアル進捗 actions
  markStepCleared: (stepId: string) => void;
  markChapterStepsCleared: (stepIds: string[]) => void;
  isStepCleared: (stepId: string) => boolean;
  startPracticeFor: (chapterNum: number) => void;
  consumePendingPractice: () => number | null;
  _setHydrated: (v: boolean) => void;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'noir',
  speed: 1.0,
  density: 'comfortable',
  spectatorAi: 800,
  favorites: [],
  cardBack: 'gold',
  bgmVolume: 50,
  seEnabled: true,
  tutorialClearedStepIds: [],
};

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      _hasHydrated: false,
      _pendingPracticeChapter: null,
      _matchMeta: null,
      setMatchMeta: (m) => set({ _matchMeta: m }),
      consumeMatchMeta: () => {
        const v = get()._matchMeta;
        if (v !== null) set({ _matchMeta: null });
        return v;
      },
      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      toggleFavorite: (cardNum) =>
        set((s) => {
          const favs = s.settings.favorites ?? [];
          const has = favs.includes(cardNum);
          return {
            settings: {
              ...s.settings,
              favorites: has ? favs.filter((n) => n !== cardNum) : [...favs, cardNum],
            },
          };
        }),
      isFavorited: (cardNum) => (get().settings.favorites ?? []).includes(cardNum),
      markStepCleared: (stepId) =>
        set((s) => {
          const cleared = s.settings.tutorialClearedStepIds ?? [];
          if (cleared.includes(stepId)) return s;
          return {
            settings: {
              ...s.settings,
              tutorialClearedStepIds: [...cleared, stepId],
            },
          };
        }),
      markChapterStepsCleared: (stepIds) =>
        set((s) => {
          const cleared = new Set(s.settings.tutorialClearedStepIds ?? []);
          for (const id of stepIds) cleared.add(id);
          return {
            settings: { ...s.settings, tutorialClearedStepIds: [...cleared] },
          };
        }),
      isStepCleared: (stepId) =>
        (get().settings.tutorialClearedStepIds ?? []).includes(stepId),
      startPracticeFor: (chapterNum) =>
        set({ _pendingPracticeChapter: chapterNum }),
      consumePendingPractice: () => {
        const v = get()._pendingPracticeChapter;
        if (v !== null) set({ _pendingPracticeChapter: null });
        return v;
      },
      _setHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'conan.meta.v1.settings',
      version: 1,
      // 永続化するのは settings のみ。_matchMeta / _pendingPracticeChapter は
      // セッション内 transient なので localStorage に書かない (古い値の読み込みを防ぐ)。
      partialize: (s) => ({ settings: s.settings }),
      onRehydrateStorage: () => (state) => {
        // Phase 12-B / 14-E / 15-A: 旧 settings の欠落フィールドを default で補填
        if (state && state.settings) {
          if (!Array.isArray(state.settings.favorites)) state.settings.favorites = [];
          if (!state.settings.cardBack)     state.settings.cardBack = 'gold';
          if (state.settings.bgmVolume == null) state.settings.bgmVolume = 50;
          if (state.settings.seEnabled == null)  state.settings.seEnabled = true;
          if (!Array.isArray(state.settings.tutorialClearedStepIds)) {
            state.settings.tutorialClearedStepIds = [];
          }
        }
        state?._setHydrated(true);
      },
    }
  )
);
