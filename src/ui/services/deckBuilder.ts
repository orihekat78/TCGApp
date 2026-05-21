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

// Round 3: event カード組込 (ユーザ要望)
//   D08: 12 character × 3 + 2 event × 2 = 40 枚 (D08024「あら…頼もしい」 / D08025「蘭の一撃」)
//   D11: 12 character × 3 + 2 event × 2 = 40 枚 (D11019「15の受難」 / D11020「18の想起」)
// rules/02: 同 ID 最大 3 枚なので event 2 枚は制約内。
// character は 14 → 12 unique に絞り、event 2 種で枚数を補う。
const D08_CHAR_IDS = [
  'D08003', 'D08005', 'D08007', 'D08009', 'D08011', 'D08013',
  'D08015', 'D08017', 'D08018', 'D08021', 'D08022', 'D08023',
] as const;
const D08_EVENT_IDS = ['D08024', 'D08025'] as const;

const D11_CHAR_IDS = [
  'D11003', 'D11004', 'D11005', 'D11006', 'D11007', 'D11009',
  'D11010', 'D11011', 'D11013', 'D11014', 'D11015', 'D11016',
] as const;
const D11_EVENT_IDS = ['D11019', 'D11020'] as const;

function buildDeck40(
  charIds: readonly string[],
  eventIds: readonly string[],
): CardId[] {
  const out: CardId[] = [];
  for (const id of charIds) out.push(id, id, id); // character × 3
  for (const id of eventIds) out.push(id, id);    // event × 2
  return out.slice(0, 40);
}

/** デッキ ID から DeckSpec (partnerId / caseId / mainCards 40 枚) を生成。 */
function buildDeckSpec(deckId: DeckId): DeckSpec {
  switch (deckId) {
    case 'CT-D08':
      return { partnerId: 'D08001', caseId: 'D08026', mainCards: buildDeck40(D08_CHAR_IDS, D08_EVENT_IDS) };
    case 'CT-D11':
      return { partnerId: 'D11001', caseId: 'D11021', mainCards: buildDeck40(D11_CHAR_IDS, D11_EVENT_IDS) };
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
