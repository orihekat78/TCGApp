// Task 8.4b: MVP DeckPair builder
//
// rules: 02-deck-construction.md (40枚・同 ID 最大 3 枚)
//
// MVP は CT-D08 (青の古城探索事件) と CT-D11 (千速と重悟の婚活パーティー) の
// 2 デッキを提供。BUG-042 (#17) で self / opp ごとに独立選択可能化。
// 整合性は engine.flow.setup.init() の validateDeck() で実行時に保証。

import type { DeckPair } from '@/engine/flow/setup';

type CardId = string;
type DeckSpec = DeckPair['self'];  // engine.flow.setup の Deck 型を借用

/** ゲーム開始時に選択可能なデッキ ID。Phase 9+ で追加可。 */
export type DeckId = 'CT-D08' | 'CT-D11';

export const AVAILABLE_DECKS: ReadonlyArray<{ id: DeckId; label: string }> = [
  { id: 'CT-D08', label: 'CT-D08 — 青の古城探索事件' },
  { id: 'CT-D11', label: 'CT-D11 — 千速と重悟の婚活パーティー' },
];

// 公式構築済みデッキの印刷カード別収録枚数を保持する。
// パラレル印刷は別 num だが、同一公式 ID の合計が最大 3 枚になる。
type DeckEntry = readonly [id: CardId, count: number];

const D08_MAIN: readonly DeckEntry[] = [
  ['D08003', 1], ['D08004', 2], ['D08005', 1], ['D08006', 2],
  ['D08007', 1], ['D08008', 2], ['D08009', 1], ['D08010', 2],
  ['D08011', 1], ['D08012', 2], ['D08013', 1], ['D08014', 2],
  ['D08015', 1], ['D08016', 2], ['D08017', 1], ['D08018', 2],
  ['D08019', 1], ['D08020', 2], ['D08021', 2], ['D08022', 3],
  ['D08023', 2], ['D08024', 3], ['D08025', 3],
];

const D11_MAIN: readonly DeckEntry[] = [
  ['D11003', 1], ['D11004', 2], ['D11005', 1], ['D11006', 2],
  ['D11007', 1], ['D11008', 2], ['D11009', 1], ['D11010', 2],
  ['D11011', 3], ['D11012', 3], ['D11013', 3], ['D11014', 3],
  ['D11015', 3], ['D11016', 3], ['D11017', 3], ['D11018', 3],
  ['D11019', 2], ['D11020', 2],
];

function expandDeck(entries: readonly DeckEntry[]): CardId[] {
  return entries.flatMap(([id, count]) => Array.from({ length: count }, () => id));
}

/** デッキ ID から DeckSpec (partnerId / caseId / mainCards 40 枚) を生成。 */
function buildDeckSpec(deckId: DeckId): DeckSpec {
  switch (deckId) {
    case 'CT-D08':
      return { partnerId: 'D08001', caseId: 'D08026', mainCards: expandDeck(D08_MAIN) };
    case 'CT-D11':
      return { partnerId: 'D11001', caseId: 'D11021', mainCards: expandDeck(D11_MAIN) };
  }
}

/**
 * 任意の self / opp デッキ組み合わせで DeckPair を生成 (BUG-042 / user_request #17)。
 *
 * - 各 main 40 枚、同 ID 最大 3 枚 (rules/02 制約準拠)
 * - 同一 deck を双方が使う対戦 (ミラー戦) も可
 */
export function buildDeckPair(opts: { selfDeckId: DeckId; oppDeckId: DeckId }): DeckPair {
  return {
    self: buildDeckSpec(opts.selfDeckId),
    opp:  buildDeckSpec(opts.oppDeckId),
  };
}

/**
 * MVP のデフォルト DeckPair を生成 (後方互換)。
 * - self = CT-D08 (青)、opp = CT-D11 (黄)
 * - 既存 import を壊さないため API は維持、内部は buildDeckPair に委譲。
 */
export function buildMvpDeckPair(): DeckPair {
  return buildDeckPair({ selfDeckId: 'CT-D08', oppDeckId: 'CT-D11' });
}
