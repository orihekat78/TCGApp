// tests/helpers/fixtures.ts — テスト共通 fixture (refactor Phase 1c, 2026-06-12)
//
// 旧来 70 箇所にコピペされていた SceneCharacter / EffectCtx fixture の正準定義。
// スキーマ変更 (フィールド追加等) は本ファイルのみで吸収する。
//
// 使い分け:
// - makeChar(overrides)            — overrides 型 (engine 系 test の主流)
// - sceneChar(cardId, uid, over?)  — 位置引数型 (cards 系 batch test の主流)。
//   enterOrderThisTurn: 1 を含む (旧 sceneChar コピー群と deep-equal。プロパティ挿入順のみ
//   末尾に移る — snapshot / JSON.stringify 比較を導入する場合は注意)
// - makeCtx(overrides)             — EffectCtx fixture
//
// 既定値が異なる test file は、本関数へ委譲する薄い local adapter を維持する
// (呼び出し箇所 = テスト本文は不変、という Phase 1c の制約に従う)。

import type { SceneCharacter, EffectCtx } from '@/engine/types';

export function makeChar(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    cardId: 'C001',
    uid: 'uid-1',
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...overrides,
  };
}

export function sceneChar(
  cardId: string,
  uid: string,
  over: Partial<SceneCharacter> = {},
): SceneCharacter {
  return makeChar({ cardId, uid, enterOrderThisTurn: 1, ...over });
}

export function makeCtx(overrides: Partial<EffectCtx> = {}): EffectCtx {
  return {
    source: { player: 'self', area: 'scene' },
    bindings: {},
    ...overrides,
  };
}
