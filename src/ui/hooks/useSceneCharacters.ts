// Phase 7 Task 7.4: SceneArea selector hook
// rules: 03-field-areas.md §現場

import type { SceneCharacter } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';

const EMPTY: SceneCharacter[] = [];

/**
 * gameState から指定サイドの scene (現場) キャラ配列を選択する。
 * gameState が null のときは空配列を返す (UI は空 5 スロットを描画)。
 */
export function useSceneCharacters(side: 'self' | 'opp'): SceneCharacter[] {
  return useGameStateStore(
    (s) => s.gameState?.players[side].scene ?? EMPTY,
  );
}
