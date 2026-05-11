// engine.invariant.frozenSurface — 骨格凍結対象シンボルリスト
// rules: CLAUDE.md (骨格凍結原則)

/**
 * 骨格凍結対象シンボルリスト (定数)
 * 後続テストで違反検出用 — Phase 9 で完全実装
 */
export const frozenSurface: ReadonlyArray<string> = [
  // engine core (骨格)
  'engine/produce',
  'engine/state-factory',
  'engine/types/game-state',
  'engine/types/effect',
  'engine/types/results',
  'engine/types/hooks',
  'engine/mutate/deck',
  'engine/mutate/hand',
  'engine/mutate/scene',
  'engine/mutate/char',
  'engine/read/turn',
  'engine/read/player',
  'engine/read/scene',
  'engine/read/char',
  'engine/read/game',
  'engine/read/log',
  'engine/read/def',
];

/**
 * 骨格凍結の確認 (起動時に呼出)
 * 現在は no-op スタブ — Phase 9 で完全実装
 */
export function assertFrozen(): void {
  // Phase 9 で: frozenSurface のシンボルが変更されていないか検証
  // 現時点では no-op
}
