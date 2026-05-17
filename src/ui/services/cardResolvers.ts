// Phase 7 demo wiring: cardId → 表示用メタ解決
// SceneArea / PartnerArea / RemoveArea / FileArea / CaseArea 共用。
// cards.json (CT-D08 / CT-D11) を入力として受け取る factory パターン。
// テスト時は固定 JSON を渡せる、本番は App.tsx で root の JSON を import。

import type { ResolvedCardMeta, CardColor } from '@/ui/components/SceneArea.js';

export type RawCard = {
  cardId: string;
  cardNum: string;
  title: string;
  type: '事件' | 'パートナー' | 'キャラ' | 'イベント';
  color: string;          // 日本語 ('青' / '黄' / '赤' / '緑' / '紫')
  cost: string | null;
  ap: string | null;
  lp: string | null;
  rarity?: string;
  mainPath?: string;
  features?: string[];
  effect?: string | null;
  cutIn?: string | null;
  hirameki?: string | null;
  henso?: string | null;
  difficultyFirst?: number | null;
  difficultySecond?: number | null;
};

export type RawCardsJson = {
  count: number;
  cards: RawCard[];
};

export type CaseMeta = {
  title: string;
  color: CardColor;
  level: number;
  /** カードの向き。cards.json に orientation 情報が無い場合は portrait に解決される。
   *  Phase 8.5 追加 — landscape promo / 拡張用 (MVP CT-D08/CT-D11 は portrait のみ)。 */
  orientation?: 'portrait' | 'landscape';
};

const JP_COLOR_TO_EN: Record<string, CardColor> = {
  '青': 'blue',
  '黄': 'yellow',
  '赤': 'red',
  '緑': 'green',
  '紫': 'purple',
};

function parseIntSafe(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function mapColor(jp: string): CardColor {
  return JP_COLOR_TO_EN[jp] ?? 'blue';
}

function buildIndex(sources: RawCardsJson[]): Map<string, RawCard> {
  // engine.cards registry のキーは def.id = cardNum (D-prefix) なので
  // resolver も cardNum をキーにして整合性を取る。
  // 旧 `card.cardId` (4桁数字) は JSON 独自のフィールドで registry とズレていた。
  const idx = new Map<string, RawCard>();
  for (const src of sources) {
    for (const card of src.cards) {
      idx.set(card.cardNum, card);
    }
  }
  return idx;
}

/**
 * cardId → ResolvedCardMeta (キャラ / パートナー / イベント表示用)
 * 未登録 ID は `{ name: '???', color: 'blue', ap: 0, lp: 0, lv: 0 }`
 */
export function createCardResolver(
  ...sources: RawCardsJson[]
): (cardId: string) => ResolvedCardMeta {
  const idx = buildIndex(sources);
  return (cardId: string): ResolvedCardMeta => {
    const raw = idx.get(cardId);
    if (!raw) {
      return { name: '???', color: 'blue', ap: 0, lp: 0, lv: 0 };
    }
    return {
      name: raw.title,
      color: mapColor(raw.color),
      ap: parseIntSafe(raw.ap),
      lp: parseIntSafe(raw.lp),
      // 'lv' は JSON に無い (cardNum 等から推定不能) — placeholder 0
      lv: parseIntSafe(raw.cost ?? '0'),
    };
  };
}

/**
 * cardId → HandCardMeta (手札表示用、type/cost/ap/lp/lv 込み)
 * イベント・パートナーで ap/lp が null の場合は null のまま (UI 側で '—' 表示)。
 * 未登録 ID は placeholder (cost=0, type='キャラ')。
 */
export type HandCardMeta = {
  cardId: string;
  name: string;
  color: CardColor;
  type: 'キャラ' | 'イベント';
  cost: number;
  ap: number | null;
  lp: number | null;
  lv: number;
};

function parseIntOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function mapCardType(jp: RawCard['type']): 'キャラ' | 'イベント' {
  // パートナーは手札に来ないので キャラ 扱い、事件 も同様 (実用上は不要なケース)
  return jp === 'イベント' ? 'イベント' : 'キャラ';
}

export function createHandCardResolver(
  ...sources: RawCardsJson[]
): (cardId: string) => HandCardMeta {
  const idx = buildIndex(sources);
  return (cardId: string): HandCardMeta => {
    const raw = idx.get(cardId);
    if (!raw) {
      return { cardId, name: '???', color: 'blue', type: 'キャラ', cost: 0, ap: null, lp: null, lv: 0 };
    }
    return {
      cardId,
      name: raw.title,
      color: mapColor(raw.color),
      type: mapCardType(raw.type),
      cost: parseIntSafe(raw.cost),
      ap: parseIntOrNull(raw.ap),
      lp: parseIntOrNull(raw.lp),
      lv: parseIntSafe(raw.cost),
    };
  };
}

/**
 * cardId → CaseMeta (事件カード専用、title/color/level)
 * 未登録 ID または type !== '事件' は cardId をタイトルにフォールバック。
 */
export function createCaseResolver(
  ...sources: RawCardsJson[]
): (cardId: string) => CaseMeta {
  const idx = buildIndex(sources);
  return (cardId: string): CaseMeta => {
    const raw = idx.get(cardId);
    if (!raw || raw.type !== '事件') {
      return { title: cardId, color: 'blue', level: 0 };
    }
    // Phase 9-D: cards.json に orientation が明示されているときのみ採用。
    // 未指定なら undefined を返し、CaseArea 側の `useCardOrientation` (画像実測)
    // にフォールバックさせる。`'portrait'` を default で返すと auto-detect が
    // 効かなくなるため要 undefined。
    const rawAny = raw as RawCard & { orientation?: string };
    const orientation: 'portrait' | 'landscape' | undefined =
      rawAny.orientation === 'landscape' ? 'landscape'
      : rawAny.orientation === 'portrait' ? 'portrait'
      : undefined;
    return {
      title: raw.title,
      color: mapColor(raw.color),
      // 事件 level は difficultyFirst / difficultySecond の最大値 (or cost)。
      // cards.json の数値型カラムは string | null なので安全に parseInt。
      level: Math.max(
        parseIntSafe(raw.difficultyFirst),
        parseIntSafe(raw.difficultySecond),
        parseIntSafe(raw.cost),
      ),
      orientation,
    };
  };
}
