// Task 8.4b: MVP DeckPair builder
//
// rules: 02-deck-construction.md (40枚・同 ID 最大 3 枚)
//
// CT-D08 (青の古城探索事件) を self、CT-D11 (千速と重悟の婚活パーティー) を opp に固定。
// MVP では デッキ選択 UI を出さず、両者固定の対戦を提供。
// 整合性は engine.flow.setup.init() の validateDeck() で実行時に保証。

import type { DeckPair } from '@/engine/flow/setup';

type CardId = string;

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

/**
 * MVP の DeckPair を生成する。
 * - self = CT-D08 (青)、opp = CT-D11 (黄)
 * - 各 main 40 枚、同 ID 最大 3 枚 (rules/02 制約準拠)
 * - Round 3: event カード × 2 種 × 2 枚 含む
 */
export function buildMvpDeckPair(): DeckPair {
  return {
    self: { partnerId: 'D08001', caseId: 'D08026', mainCards: buildDeck40(D08_CHAR_IDS, D08_EVENT_IDS) },
    opp:  { partnerId: 'D11001', caseId: 'D11021', mainCards: buildDeck40(D11_CHAR_IDS, D11_EVENT_IDS) },
  };
}
