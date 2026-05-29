// 06-card-data.jsx
// Sample cards lifted from the real ct-d08 (江戸川コナン starter) and
// ct-d11 (萩原千速 starter) decks. Just enough variety to populate the
// deck editor with plausible content.
//
// Shape: { num, name, type, color, cost, ap, lp, rarity, features, effectShort, keywords }
//   type:    'partner' | 'character' | 'event' | 'cutin'
//   color:   'blue' | 'yellow' | 'red' | 'green' | 'purple'
//   cost/ap: number or null (partners don't have cost/ap)
//   keywords: ['ヒラメキ', 'カットイン', '突撃', ...] for chip display

const CARD_POOL = [
  // ── ct-d08 / Blue (少年探偵団) ───────────────────────────
  { num: 'D08001', name: '江戸川コナン', type: 'partner', color: 'blue', cost: null, ap: null, lp: 1, rarity: 'D', features: [], effectShort: '【解決編】【事件解決】【スリープ】証拠が事件レベル以上で勝利。【アシスト】FILEエリアに移動、7枚以上で事件を解決編に。', keywords: ['アシスト'] },
  { num: 'D08002', name: '哀 歩美 光彦 元太', type: 'partner', color: 'blue', cost: null, ap: null, lp: 1, rarity: 'D', features: [], effectShort: '【解決編】【事件解決】【スリープ】証拠が事件レベル以上で勝利。【アシスト】FILEエリアに移動、7枚以上で事件を解決編に。', keywords: ['アシスト'] },
  { num: 'D08003', name: '江戸川コナン', type: 'character', color: 'blue', cost: 8, ap: 7000, lp: 2, rarity: 'D', features: ['探偵', '毛利探偵事務所', '少年探偵団'], effectShort: '【パートナー青】【登場時】手札から少年探偵団を2リムーブでAP8000以下を1枚リムーブ。ターン終了時、現場に少年探偵団が3枚以上でドロー。', keywords: [] },
  { num: 'D08005', name: '灰原哀', type: 'character', color: 'blue', cost: 7, ap: 6000, lp: 1, rarity: 'D', features: ['少年探偵団', '科学者'], effectShort: '【自分ターン中】表向き証拠1つにつきAP＋1000。【宣言】【ターン1】〈裏向き証拠を1表〈: 　〈突撃〉を得る。', keywords: ['宣言'] },
  { num: 'D08007', name: '吉田歩美', type: 'character', color: 'blue', cost: 2, ap: 1000, lp: 1, rarity: 'D', features: ['少年探偵団'], effectShort: '少年探偵団1枚につきAP＋1000。', keywords: ['カットイン'] },
  { num: 'D08009', name: '小嶋元太', type: 'character', color: 'blue', cost: 5, ap: 5000, lp: 0, rarity: 'D', features: ['少年探偵団'], effectShort: '〚突撃〛持ち。', keywords: ['突撃'] },
  { num: 'D08011', name: '円谷光彦', type: 'character', color: 'blue', cost: 6, ap: 5000, lp: 1, rarity: 'D', features: ['少年探偵団'], effectShort: '少年探偵団がいれば〚突撃〛。', keywords: ['突撃'] },
  { num: 'D08013', name: '吉田歩美', type: 'character', color: 'blue', cost: 4, ap: 4000, lp: 1, rarity: 'D', features: ['少年探偵団'], effectShort: '【登場時】証拠1つ得る/手札交換。', keywords: ['ヒラメキ'] },
  { num: 'D08015', name: '小嶋元太', type: 'character', color: 'blue', cost: 3, ap: 2000, lp: 1, rarity: 'D', features: ['少年探偵団'], effectShort: 'ドロー→ハンドリムーブ。', keywords: ['カットイン'] },
  { num: 'D08017', name: '円谷光彦', type: 'character', color: 'blue', cost: 2, ap: 1000, lp: 1, rarity: 'D', features: ['少年探偵団'], effectShort: '——', keywords: ['カットイン'] },
  { num: 'D08019', name: '阿笠博士', type: 'character', color: 'blue', cost: 5, ap: 5000, lp: 1, rarity: 'D', features: ['発明家'], effectShort: '【解決編】少年探偵団いるならスリープ。', keywords: ['ヒラメキ'] },
  { num: 'D08021', name: '毛利蘭', type: 'character', color: 'blue', cost: 6, ap: 6000, lp: 1, rarity: 'R', features: ['空手家'], effectShort: '【宣言】AP5000以下リムーブ。', keywords: ['宣言'] },
  { num: 'D08023', name: '毛利小五郎', type: 'character', color: 'blue', cost: 4, ap: 3000, lp: 1, rarity: 'C', features: ['探偵'], effectShort: '【登場時】カード1枚引く。', keywords: [] },
  { num: 'D08025', name: '怪盗キッド', type: 'character', color: 'blue', cost: 6, ap: 5000, lp: 1, rarity: 'SR', features: ['怪盗'], effectShort: '【変装】相手キャラに化ける。', keywords: ['変装', '宣言'] },

  // ── ct-d11 / Yellow (警察) ───────────────────────────
  { num: 'D11001', name: '萩原千速', type: 'partner', color: 'yellow', cost: null, ap: null, lp: 1, rarity: 'D', features: [], effectShort: '【解決編】証拠が事件レベル以上なら勝利。', keywords: ['アシスト'] },
  { num: 'D11002', name: '横溝重悟', type: 'partner', color: 'yellow', cost: null, ap: null, lp: 1, rarity: 'D', features: [], effectShort: '【解決編】証拠が事件レベル以上なら勝利。', keywords: ['アシスト'] },
  { num: 'D11003', name: '萩原千速', type: 'character', color: 'yellow', cost: 8, ap: 8000, lp: 1, rarity: 'D', features: ['警察'], effectShort: '【疾風】証拠1つ得る。', keywords: ['ヒラメキ', '疾風'] },
  { num: 'D11005', name: '横溝重悟', type: 'character', color: 'yellow', cost: 8, ap: 8000, lp: 1, rarity: 'D', features: ['警察'], effectShort: '【登場時】AP以下のキャラリムーブ。', keywords: ['宣言'] },
  { num: 'D11007', name: '安室透', type: 'character', color: 'yellow', cost: 7, ap: 7000, lp: 2, rarity: 'SR', features: ['警察', '私立探偵'], effectShort: '【登場時】手札を見て1枚リムーブ。', keywords: ['ヒラメキ'] },
  { num: 'D11009', name: '佐藤美和子', type: 'character', color: 'yellow', cost: 4, ap: 4000, lp: 1, rarity: 'R', features: ['警察'], effectShort: '【登場時】警察を1枚スリープ解除。', keywords: [] },
  { num: 'D11011', name: '高木渉', type: 'character', color: 'yellow', cost: 3, ap: 3000, lp: 1, rarity: 'C', features: ['警察'], effectShort: '——', keywords: ['カットイン'] },
  { num: 'D11013', name: '目暮十三', type: 'character', color: 'yellow', cost: 5, ap: 4000, lp: 1, rarity: 'C', features: ['警察'], effectShort: '【宣言】証拠を裏向きにする。', keywords: ['宣言'] },
  { num: 'D11015', name: '白鳥任三郎', type: 'character', color: 'yellow', cost: 4, ap: 3000, lp: 1, rarity: 'C', features: ['警察'], effectShort: '——', keywords: [] },
  { num: 'D11017', name: '千葉刑事', type: 'character', color: 'yellow', cost: 2, ap: 2000, lp: 1, rarity: 'C', features: ['警察'], effectShort: '【登場時】カード1枚引く。', keywords: [] },
  { num: 'D11019', name: '事件現場', type: 'event', color: 'yellow', cost: 2, ap: null, lp: null, rarity: 'C', features: [], effectShort: '【イベント】証拠を1つ表向きにする。', keywords: [] },
  { num: 'D11020', name: '警察手帳', type: 'event', color: 'yellow', cost: 1, ap: null, lp: null, rarity: 'C', features: [], effectShort: '【イベント】警察1枚を選び+2000。', keywords: [] },
  { num: 'D11021', name: '緊急配備', type: 'event', color: 'yellow', cost: 3, ap: null, lp: null, rarity: 'R', features: [], effectShort: '【イベント】キャラ1枚スリープ。', keywords: [] },
];

// Helper: get cards filtered by various criteria
function getCards(filter = {}) {
  return CARD_POOL.filter((c) => {
    if (filter.color && c.color !== filter.color) return false;
    if (filter.type && c.type !== filter.type) return false;
    if (filter.minCost != null && (c.cost ?? 0) < filter.minCost) return false;
    if (filter.maxCost != null && (c.cost ?? 0) > filter.maxCost) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.num.toLowerCase().includes(q) &&
          !c.features.some((f) => f.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

// A canonical sample deck (40 cards) — used as starting state in deck editor.
// Per official rules: 40 cards exactly · same card max 3 copies (by cardId).
// Format: [{num, count}, ...]. count = number of copies in deck (≤3).
const SAMPLE_DECK = {
  name: '少年探偵団・標準',
  partner: 'D08001', // 江戸川コナン
  cards: [
    { num: 'D08003', count: 2 }, // コナン (cost 8)
    { num: 'D08005', count: 3 }, // 灰原哀 (cost 7)
    { num: 'D08007', count: 3 }, // 歩美 cost 2 (←4→3)
    { num: 'D08009', count: 3 }, // 元太 cost 5
    { num: 'D08011', count: 3 }, // 光彦 cost 6
    { num: 'D08013', count: 3 }, // 歩美 cost 4
    { num: 'D08015', count: 3 }, // 元太 cost 3 (←4→3)
    { num: 'D08017', count: 3 }, // 光彦 cost 2 (←4→3)
    { num: 'D08019', count: 3 }, // 阿笠 cost 5
    { num: 'D08021', count: 3 }, // 蘭 cost 6 (←2→3)
    { num: 'D08023', count: 3 }, // 小五郎 cost 4
    { num: 'D08025', count: 2 }, // キッド cost 6
    { num: 'D11019', count: 3 }, // 事件現場 cost 2 (←2→3)
    { num: 'D11020', count: 3 }, // 警察手帳 cost 1 (←2→3)
  ],
};

// Deck stats helper
function deckStats(deck) {
  const total = deck.cards.reduce((s, c) => s + c.count, 0);
  const colors = {}, costs = {}, types = {};
  for (const entry of deck.cards) {
    const card = CARD_POOL.find((c) => c.num === entry.num);
    if (!card) continue;
    colors[card.color] = (colors[card.color] ?? 0) + entry.count;
    types[card.type] = (types[card.type] ?? 0) + entry.count;
    if (card.cost != null) {
      const k = Math.min(card.cost, 8);
      costs[k] = (costs[k] ?? 0) + entry.count;
    }
  }
  return { total, colors, costs, types };
}

window.CARD_POOL = CARD_POOL;
window.getCards = getCards;
window.SAMPLE_DECK = SAMPLE_DECK;
window.deckStats = deckStats;
