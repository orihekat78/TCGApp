// metaStore — UI settings persisted under the existing v1 storage key.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { matchSessionId } from '@/ui/services/matchSessionId';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';
import type { MatchDeckSnapshotV1 } from '../data/types';

export type DensityName = 'compact' | 'comfortable';
export type PresentationSpeedName = 'slow' | 'standard' | 'fast';
export type SpectatorAiSpeedName = 'slow' | 'standard' | 'fast';
export type CardBackId = 'gold' | 'azure' | 'crimson' | 'jade' | 'noir';

export interface Settings {
  density: DensityName;
  /** Controls only presentation timing; never AI or engine timing. */
  presentationSpeed: PresentationSpeedName;
  /** Maps to the existing engine `aiSpeedMs` only for observe matches. */
  spectatorAi: SpectatorAiSpeedName;
  favorites: string[];
  cardBack: CardBackId;
  bgmVolume: number;
  seEnabled: boolean;
  tutorialClearedStepIds: string[];
}

export interface MatchMeta {
  sessionId: string;
  mode: 'solo' | 'observe';
  selfDeckName: string;
  oppDeckName: string;
  selfDeckSnapshot?: MatchDeckSnapshotV1;
  oppDeckSnapshot?: MatchDeckSnapshotV1;
}

interface MetaState {
  settings: Settings;
  _hasHydrated: boolean;
  _pendingPracticeStepId: string | null;
  _matchMeta: MatchMeta | null;
  _setupStartError: string | null;
  setMatchMeta: (m: MatchMeta) => void;
  getMatchMeta: () => MatchMeta | null;
  clearMatchMeta: () => void;
  consumeMatchMeta: () => MatchMeta | null;
  setSetupStartError: (message: string | null) => void;
  setSettings: (patch: Partial<Settings>) => void;
  toggleFavorite: (cardNum: string) => void;
  isFavorited: (cardNum: string) => boolean;
  markStepCleared: (stepId: string) => void;
  markChapterStepsCleared: (stepIds: string[]) => void;
  isStepCleared: (stepId: string) => boolean;
  startPracticeFor: (stepId: string) => void;
  clearPendingPractice: () => void;
  consumePendingPractice: () => string | null;
  _setHydrated: (v: boolean) => void;
}

export const SPECTATOR_AI_SPEED_MS: Record<SpectatorAiSpeedName, number> = {
  slow: 800,
  standard: 400,
  fast: 200,
};

/** Stable for one runtime session and namespaced across reloads. */
export function matchMetaSessionId(token: number): string {
  return matchSessionId(token);
}

const DEFAULT_SETTINGS: Settings = {
  density: 'comfortable',
  presentationSpeed: 'standard',
  spectatorAi: 'standard',
  favorites: [],
  cardBack: 'gold',
  bgmVolume: 50,
  seEnabled: true,
  tutorialClearedStepIds: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDensity(value: unknown): value is DensityName {
  return value === 'compact' || value === 'comfortable';
}

function isPresentationSpeed(value: unknown): value is PresentationSpeedName {
  return value === 'slow' || value === 'standard' || value === 'fast';
}

function isSpectatorAiSpeed(value: unknown): value is SpectatorAiSpeedName {
  return value === 'slow' || value === 'standard' || value === 'fast';
}

function isCardBack(value: unknown): value is CardBackId {
  return value === 'gold' || value === 'azure' || value === 'crimson' || value === 'jade' || value === 'noir';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

const TUTORIAL_STEP_IDS = new Set<string>(TUTORIAL_STEPS.map((step) => step.id));

// Legacy `ch*` lessons covered a different curriculum. Only carry progress
// forward when the old lesson taught the complete canonical concept.
const LEGACY_TUTORIAL_STEP_MAP: Record<string, readonly string[]> = {
  'ch1-1': ['L1-1', 'L1-2'],
  'ch1-2': ['L2-1'],
  'ch2-3': ['L0-2'],
  'ch2-4': ['L5-1', 'L5-2'],
  'ch3-1': ['L0-1'],
  'ch3-2': ['L3-1', 'L3-2'],
  'ch4-1': ['L4-1', 'L4-2'],
  'ch4-2': ['L6-1', 'L6-2', 'L7-1'],
  'ch4-3': ['L8-1', 'L8-2'],
  'ch4-5': ['L12-1', 'L12-2'],
  'ch5-1': ['L5-1'],
  'ch5-2': ['L0-2'],
  'ch5-3': ['L5-2'],
  'ch5-4': ['L5-2'],
  'ch5-5': ['L5-4'],
  'ch6-3': ['L9-2', 'L10-2'],
  'ch7-3': ['L5-3'],
  'ch7-6': ['L12-3'],
  'ch8-1': ['L13-1'],
  'ch8-2': ['L1-2'],
  'ch8-3': ['L2-2'],
};

function canonicalTutorialStepIds(value: unknown): string[] {
  const migrated = new Set<string>();
  for (const stepId of stringArray(value)) {
    if (TUTORIAL_STEP_IDS.has(stepId)) migrated.add(stepId);
    for (const canonicalId of LEGACY_TUTORIAL_STEP_MAP[stepId] ?? []) migrated.add(canonicalId);
  }
  return TUTORIAL_STEPS.map((step) => step.id).filter((stepId) => migrated.has(stepId));
}

function migrateV1PresentationSpeed(value: unknown): PresentationSpeedName {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.presentationSpeed;
  if (value < 1) return 'slow';
  if (value > 1) return 'fast';
  return 'standard';
}

function migrateV1SpectatorAi(value: unknown): SpectatorAiSpeedName {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.spectatorAi;
  // Legacy values were millisecond delays. Preserve their intent by choosing
  // the closest named v2 delay, with ties favoring the less disruptive speed.
  if (value <= 300) return 'fast';
  if (value <= 600) return 'standard';
  if (value > 600) return 'slow';
  return DEFAULT_SETTINGS.spectatorAi;
}

/** Drops obsolete and unknown persisted keys before they reach UI consumers. */
export function normalizeSettings(value: unknown): Settings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS, favorites: [], tutorialClearedStepIds: [] };
  return {
    density: isDensity(value.density) ? value.density : DEFAULT_SETTINGS.density,
    presentationSpeed: isPresentationSpeed(value.presentationSpeed)
      ? value.presentationSpeed
      : migrateV1PresentationSpeed(value.speed),
    spectatorAi: isSpectatorAiSpeed(value.spectatorAi)
      ? value.spectatorAi
      : migrateV1SpectatorAi(value.spectatorAi),
    favorites: stringArray(value.favorites),
    cardBack: isCardBack(value.cardBack) ? value.cardBack : DEFAULT_SETTINGS.cardBack,
    bgmVolume: typeof value.bgmVolume === 'number' && Number.isFinite(value.bgmVolume)
      ? value.bgmVolume
      : DEFAULT_SETTINGS.bgmVolume,
    seEnabled: typeof value.seEnabled === 'boolean' ? value.seEnabled : DEFAULT_SETTINGS.seEnabled,
    tutorialClearedStepIds: canonicalTutorialStepIds(value.tutorialClearedStepIds),
  };
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      _hasHydrated: false,
      _pendingPracticeStepId: null,
      _matchMeta: null,
      _setupStartError: null,
      setMatchMeta: (m) => set({ _matchMeta: m }),
      getMatchMeta: () => get()._matchMeta,
      clearMatchMeta: () => set({ _matchMeta: null }),
      consumeMatchMeta: () => {
        const value = get()._matchMeta;
        if (value !== null) set({ _matchMeta: null });
        return value;
      },
      setSetupStartError: (message) => set({ _setupStartError: message }),
      setSettings: (patch) => set((state) => ({ settings: normalizeSettings({ ...state.settings, ...patch }) })),
      toggleFavorite: (cardNum) => set((state) => {
        const favorites = state.settings.favorites;
        return { settings: { ...state.settings, favorites: favorites.includes(cardNum)
          ? favorites.filter((value) => value !== cardNum)
          : [...favorites, cardNum] } };
      }),
      isFavorited: (cardNum) => get().settings.favorites.includes(cardNum),
      markStepCleared: (stepId) => set((state) => {
        if (!TUTORIAL_STEP_IDS.has(stepId)) return state;
        const cleared = state.settings.tutorialClearedStepIds;
        if (cleared.includes(stepId)) return state;
        return { settings: { ...state.settings, tutorialClearedStepIds: [...cleared, stepId] } };
      }),
      markChapterStepsCleared: (stepIds) => set((state) => {
        const canonicalIds = stepIds.filter((stepId) => TUTORIAL_STEP_IDS.has(stepId));
        return {
          settings: {
            ...state.settings,
            tutorialClearedStepIds: [...new Set([...state.settings.tutorialClearedStepIds, ...canonicalIds])],
          },
        };
      }),
      isStepCleared: (stepId) => get().settings.tutorialClearedStepIds.includes(stepId),
      startPracticeFor: (stepId) => set({
        _pendingPracticeStepId: TUTORIAL_STEP_IDS.has(stepId) ? stepId : null,
      }),
      clearPendingPractice: () => set({ _pendingPracticeStepId: null }),
      consumePendingPractice: () => {
        const value = get()._pendingPracticeStepId;
        if (value !== null) set({ _pendingPracticeStepId: null });
        return value;
      },
      _setHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'conan.meta.v1.settings',
      version: 2,
      partialize: (state) => ({ settings: state.settings }),
      migrate: (persistedState) => {
        const persisted = isRecord(persistedState) ? persistedState : {};
        return { settings: normalizeSettings(persisted.settings) };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.settings = normalizeSettings(state.settings);
        state?._setHydrated(true);
      },
    },
  ),
);
