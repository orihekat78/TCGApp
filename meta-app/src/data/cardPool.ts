// spec: .claude/specs/meta-ui/05-engine-stub.md + 11-cards-rebuild.md
// Phase 12-A: CT-D08 (26 枚) + CT-D11 (21 枚) = 47 枚を JSON 直読
// JSON は src/ と同じソース (../../../ct-d08-cards.json, ct-d11-cards.json)
// 5173 は src/App.tsx で同じ JSON を resolveCard に渡す。5174 はメタ表示用に CardDef へ正規化

import type { CardColor, CardDef, CardKind } from './types';
import ctD08Raw from '../../../ct-d08-cards.json';
import ctD11Raw from '../../../ct-d11-cards.json';

interface RawCard {
  cardId: string;
  cardNum: string;
  title: string;
  type: string;
  color: string;
  cost: string | null;
  ap: string | null;
  lp: string | null;
  rarity: string;
  mainPath?: string;
  features: string[];
  effect: string;
  cutIn?: string | null;
  hirameki?: string | null;
  henso?: string | null;
  difficultyFirst?: string | null;
  difficultySecond?: string | null;
}

const TYPE_MAP: Record<string, CardKind> = {
  'パートナー': 'partner',
  'キャラ':     'character',
  'イベント':   'event',
  '事件':       'case',
};

const COLOR_MAP: Record<string, CardColor> = {
  '青': 'blue',
  '黄': 'yellow',
  '赤': 'red',
  '緑': 'green',
  '紫': 'purple',
};

function toNum(v: string | null | undefined): number | undefined {
  if (v == null || v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function extractKeywords(raw: RawCard): string[] {
  const ks = new Set<string>();
  if (raw.cutIn)    ks.add('カットイン');
  if (raw.hirameki) ks.add('ヒラメキ');
  if (raw.henso)    ks.add('変装');
  const e = raw.effect ?? '';
  if (e.includes('突撃'))    ks.add('突撃');
  if (e.includes('迅速'))    ks.add('迅速');
  if (e.includes('【宣言】')) ks.add('宣言');
  if (e.includes('疾風'))    ks.add('疾風');
  if (e.includes('ミスリード')) ks.add('ミスリード');
  if (e.includes('ブレット'))   ks.add('ブレット');
  if (e.includes('捜査'))      ks.add('捜査');
  if (e.includes('痕跡'))      ks.add('痕跡');
  if (raw.type === 'パートナー') ks.add('アシスト');
  return [...ks];
}

function toCardDef(raw: RawCard): CardDef {
  return {
    num: raw.cardNum,
    id: raw.cardId,
    name: raw.title,
    type: TYPE_MAP[raw.type] ?? 'character',
    color: COLOR_MAP[raw.color] ?? 'blue',
    cost:  toNum(raw.cost),
    ap:    toNum(raw.ap),
    lp:    toNum(raw.lp),
    level: toNum(raw.difficultyFirst),
    rarity: raw.rarity,
    features: raw.features ?? [],
    keywords: extractKeywords(raw),
    effectShort: raw.effect ?? '',
  };
}

const D08: readonly CardDef[] = (ctD08Raw.cards as RawCard[]).map(toCardDef);
const D11: readonly CardDef[] = (ctD11Raw.cards as RawCard[]).map(toCardDef);

export const CARD_POOL: readonly CardDef[] = [...D08, ...D11];

// cardNum → cardId 解決テーブル。パラレル (同 id・別 num) を「同じカード」として
// 集計するために使う (3 枚上限 / 種類カウント)。rules/02-deck-construction.md。
const NUM_TO_ID = new Map<string, string>(CARD_POOL.map((c) => [c.num, c.id]));

/** 印刷番号 (cardNum) から正規カードID (cardId) を引く。未知の num はそのまま返す。 */
export function cardIdOf(num: string): string {
  return NUM_TO_ID.get(num) ?? num;
}

/** デッキエントリ列を cardId 単位で合算した枚数 Map を返す (パラレルを合算)。 */
export function countsByCardId(
  entries: readonly { num: string; count: number }[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const id = cardIdOf(e.num);
    m.set(id, (m.get(id) ?? 0) + e.count);
  }
  return m;
}

/** cardId ごとに 1 枚 (最初の印刷) に畳んだカード一覧。「種類」表示・パラレル統合表示に使う。 */
export const DISTINCT_CARDS: readonly CardDef[] = (() => {
  const seen = new Set<string>();
  const out: CardDef[] = [];
  for (const c of CARD_POOL) {
    if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
  }
  return out;
})();

/** カード種類 (distinct cardId) の総数。CARD_POOL は cardNum 単位なのでパラレルを畳む。 */
export const DISTINCT_CARD_COUNT = DISTINCT_CARDS.length;

/** 指定 cardId の全印刷 (パラレル含む) を返す。 */
export function variantsOfId(id: string): CardDef[] {
  return CARD_POOL.filter((c) => c.id === id);
}

// パートナー → 既定の事件カード (cardNum)。明示マップに無ければ色で推定する
// (黄系 = 千速と重悟 / それ以外 = 青の古城)。デッキ未指定時の補填・移行に使う。
const PARTNER_TO_CASE: Record<string, string> = {
  D08001: 'D08026', D08002: 'D08026', // CT-D08 → 青の古城探索事件
  D11001: 'D11021', D11002: 'D11021', // CT-D11 → 千速と重悟の婚活パーティー
};

/** パートナー cardNum から既定の事件 cardNum を推定する。 */
export function defaultCaseForPartner(partnerNum: string): string {
  if (PARTNER_TO_CASE[partnerNum]) return PARTNER_TO_CASE[partnerNum]!;
  const partner = CARD_POOL.find((c) => c.num === partnerNum);
  return partner?.color === 'yellow' ? 'D11021' : 'D08026';
}

/** 事件カード一覧 (デッキの事件スロット選択用)。 */
export const CASE_CARDS: readonly CardDef[] = CARD_POOL.filter((c) => c.type === 'case');

/** パートナーカード一覧 (デッキのパートナースロット選択用)。 */
export const PARTNER_CARDS: readonly CardDef[] = CARD_POOL.filter((c) => c.type === 'partner');

export interface CardFilter {
  color?: CardColor;
  type?: CardKind;
  minCost?: number;
  maxCost?: number;
  rarity?: string;
  q?: string;
}

export function getCards(filter: CardFilter = {}): CardDef[] {
  return CARD_POOL.filter((c) => {
    if (filter.color && c.color !== filter.color) return false;
    if (filter.type && c.type !== filter.type) return false;
    if (filter.rarity && c.rarity !== filter.rarity) return false;
    if (filter.minCost != null && (c.cost ?? 0) < filter.minCost) return false;
    if (filter.maxCost != null && (c.cost ?? 0) > filter.maxCost) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      const inName = c.name.toLowerCase().includes(q);
      const inNum = c.num.toLowerCase().includes(q);
      const inId = c.id.toLowerCase().includes(q);
      const inFeats = (c.features ?? []).some((f) => f.toLowerCase().includes(q));
      if (!inName && !inNum && !inId && !inFeats) return false;
    }
    return true;
  });
}
