// spec: .claude/specs/meta-ui/05-engine-stub.md + 11-cards-rebuild.md
// 2026-06-16: CARD_POOL の source を engine の ALL_CARDS に変更
//   (旧: CT-D08/D11 の JSON 47枚 直読 → 新: 全実装カード ~1338枚を engine から自動導出)。
// カードを engine の ALL_CARDS に追加するだけで、カードリスト/フィルタ/デッキ編集に自動的に出る。
// 画像も解決される (main.tsx の registerAll() が全 CardDef を engine.cards に登録 →
// useCardImage(num)→engine.cards.get(num).imageUrl)。
//   - num = engine.id (画像 lookup キー)
//   - id  = cardId: パラレル P サフィックスを除去し共有 = 「同じカード」(rules/02)

import type { CardColor, CardDef, CardKind } from './types';
import type { CardDef as EngineCardDef } from '@/engine/types';
import { ALL_CARDS } from '@/cards/index';
import { CASE_DIFFICULTIES_BY_NUM } from './caseDifficulties.generated';

const COLOR_MAP: Record<string, CardColor> = {
  '青': 'blue', '黄': 'yellow', '赤': 'red', '緑': 'green', '紫': 'purple', '黒': 'black', '白': 'white',
  blue: 'blue', yellow: 'yellow', red: 'red', green: 'green', purple: 'purple', black: 'black', white: 'white',
};

/** engine.no ("<公式cardId>/<印刷番号>"、例 "0015/B01019") から公式 cardId を取り出す。
 *  rules/02「絵柄が違っても ID が同じであれば同じカード」= 公式 cardId が一致すれば同一カード。
 *  パラレル (B01019/B01019P) も別収録 (B01019/D10018/D10019、シェリー 0388=D07002/D07003) も
 *  同じ公式 cardId を共有するため、印刷番号の P 接尾辞剥がしではなく no の公式 cardId で合算する
 *  (旧 toCardId は P 接尾辞のみ剥がしていたため別収録を別カード扱いし、同一カードを 3 枚超
 *   入れられるバグになっていた)。 */
function officialCardId(no: string): string {
  const slash = no.indexOf('/');
  return slash > 0 ? no.slice(0, slash) : no;
}

/** 印刷番号から公式の商品・収録弾へ結ぶ。
 * Bxx はブースターパック CT-Pxx、Dxx はスタートデッキ CT-Dxx、PR はプロモ群。
 * パラレル接尾辞は同じ商品へ集約する。 */
export function cardSetCode(num: string): string {
  const booster = /^B(\d{2})/i.exec(num);
  if (booster) return `CT-P${booster[1]}`;
  const deck = /^D(\d{2})/i.exec(num);
  if (deck) return `CT-D${deck[1]}`;
  if (/^PR/i.test(num)) return 'PR';
  return 'その他';
}

/** ability の公式テキスト + engine.keywords からデッキ編集フィルタ用キーワードを抽出。 */
function deriveKeywords(e: EngineCardDef): string[] {
  const ks = new Set<string>(e.keywords ?? []);
  if (e.kind === 'partner') ks.add('アシスト');
  const text = (e.abilities ?? []).map((a) => a.description ?? '').join(' ');
  if (text.includes('カットイン')) ks.add('カットイン');
  if (text.includes('ヒラメキ')) ks.add('ヒラメキ');
  if (text.includes('変装')) ks.add('変装');
  if (text.includes('突撃')) ks.add('突撃');
  if (text.includes('迅速')) ks.add('迅速');
  if (text.includes('【宣言】') || (e.abilities ?? []).some((a) => a.type === 'declared')) ks.add('宣言');
  if (text.includes('疾風')) ks.add('疾風');
  if (text.includes('ミスリード')) ks.add('ミスリード');
  if (text.includes('ブレット')) ks.add('ブレット');
  if (text.includes('捜査')) ks.add('捜査');
  if (text.includes('痕跡')) ks.add('痕跡');
  return [...ks];
}

/** engine CardDef → meta CardDef へ正規化。 */
function engineToMeta(e: EngineCardDef): CardDef {
  // コスト = 手札から使う際の FILE レベル (rules/12)。character/event のみが持つ
  // (rules/28-errata.md: カードの「コスト」表記は「レベル」の誤記)。
  // partner は開始時から場に居る / case は勝利条件枠 = コスト概念なし (rules/06) →
  // 種別=パートナー/事件 を選ぶとコスト facet は全 0 件 = disabled (ありえない選択肢)。
  const playLevel = (e.kind === 'character' || e.kind === 'event') ? e.level : undefined;
  // 混色カードは複数色を保持 (rules/20)。color は表示用の代表色 (= 先頭)。
  const colors = [...new Set((e.colors ?? []).map((c) => COLOR_MAP[c] ?? 'blue'))];
  const primary: CardColor = colors[0] ?? 'blue';
  const caseDifficulty = e.kind === 'case' ? CASE_DIFFICULTIES_BY_NUM[e.id] : undefined;
  if (e.kind === 'case' && !caseDifficulty) {
    throw new Error(`official case difficulty is missing for ${e.id}`);
  }
  return {
    num: e.id,
    id: officialCardId(e.no),
    setCode: cardSetCode(e.id),
    name: e.names[0] ?? e.id,
    type: e.kind,
    color: primary,
    colors: colors.length ? colors : [primary],
    cost: playLevel,
    ap: e.ap,
    lp: e.lp,
    // `cost` は手札使用コストだけ、`level` は事件カードの表示値も保持する。
    level: e.kind === 'case' ? (e.caseLevel ?? e.level) : playLevel,
    difficultyFirst: caseDifficulty?.first,
    difficultySecond: caseDifficulty?.second,
    rarity: e.rarity,
    features: e.kind === 'case' ? (e.caseTraits ?? e.traits) : e.traits,
    keywords: deriveKeywords(e),
    effectShort: (e.abilities ?? []).map((a) => a.description).filter(Boolean).join('\n'),
    deckLimit: e.deckLimit,
  };
}

export const CARD_POOL: readonly CardDef[] = ALL_CARDS.map(engineToMeta);

/** フィルタに出す収録弾。商品系列→弾番号の順で安定させる。 */
export const ALL_CARD_SETS: readonly string[] = (() => {
  const sets = [...new Set(CARD_POOL.map((card) => card.setCode ?? cardSetCode(card.num)))];
  const rank = (code: string) => code.startsWith('CT-P') ? 0 : code.startsWith('CT-D') ? 1 : code === 'PR' ? 2 : 3;
  return sets.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ja', { numeric: true }));
})();

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

const CARD_VARIANTS_BY_ID: ReadonlyMap<string, readonly CardDef[]> = (() => {
  const variants = new Map<string, CardDef[]>();
  for (const card of CARD_POOL) {
    const group = variants.get(card.id);
    if (group) group.push(card);
    else variants.set(card.id, [card]);
  }
  return variants;
})();

/** 指定 cardId の全印刷 (パラレル含む) を返す。 */
export function variantsOfId(id: string): CardDef[] {
  return [...(CARD_VARIANTS_BY_ID.get(id) ?? [])];
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
    if (filter.color && !(c.colors ?? [c.color]).includes(filter.color)) return false;
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
