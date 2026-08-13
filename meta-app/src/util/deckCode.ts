// spec: .claude/specs/meta-ui/ (Phase 18: デッキコードのコピペ入出力)
// Master Duel 研究: 公式クライアントはコピペ用デッキコードを持たず不評だった点を解消する。
// パートナー + 事件 + 40 枚 (num,count) を 1 つのテキストコードに可逆エンコードする。

import type { DeckRecord } from '../data/types';
import { deckLegalityCatalogResolver } from '../../../src/shared/deck-legality-catalog.generated';
import { validateDeckLegality } from '../../../src/shared/deck-legality';

const PREFIX = 'CONAN1:';

interface DeckCodePayload {
  n?: string;          // name
  p: string;           // partner cardNum
  c: string;           // case cardNum
  cards: [string, number][]; // [num, count]
}

export interface DecodedDeck {
  name: string;
  partner: string;
  case: string;
  cards: { num: string; count: number }[];
}

// UTF-8 安全な base64 (日本語デッキ名対応)。
function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(b: string): string {
  return decodeURIComponent(escape(atob(b)));
}

export function encodeDeck(deck: DeckRecord): string {
  const payload: DeckCodePayload = {
    n: deck.name,
    p: deck.partner,
    c: deck.case,
    cards: deck.cards.map((e) => [e.num, e.count]),
  };
  return PREFIX + b64encode(JSON.stringify(payload));
}

/** デッキコードを復号する。形式不正なら null。 */
export function decodeDeck(code: string): DecodedDeck | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return null;
  try {
    const payload = JSON.parse(b64decode(trimmed.slice(PREFIX.length))) as DeckCodePayload;
    if (!payload || typeof payload.p !== 'string' || !Array.isArray(payload.cards)) return null;
    const seen = new Set<string>();
    const cards: DecodedDeck['cards'] = [];
    for (const entry of payload.cards) {
      if (
        !Array.isArray(entry)
        || entry.length !== 2
        || typeof entry[0] !== 'string'
        || !Number.isSafeInteger(entry[1])
        || entry[1] < 1
        || seen.has(entry[0])
      ) return null;
      seen.add(entry[0]);
      cards.push({ num: entry[0], count: entry[1] });
    }
    const decoded: DecodedDeck = {
      name: typeof payload.n === 'string' && payload.n ? payload.n : 'インポートデッキ',
      partner: payload.p,
      case: typeof payload.c === 'string' ? payload.c : '',
      cards,
    };
    return validateDeckLegality({
      partner: decoded.partner,
      case: decoded.case,
      main: decoded.cards.map(({ num, count }) => ({ printingId: num, count })),
    }, deckLegalityCatalogResolver).ok ? decoded : null;
  } catch {
    return null;
  }
}
