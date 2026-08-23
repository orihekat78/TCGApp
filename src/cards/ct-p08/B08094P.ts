// cards/ct-p08/B08094P 裏切りの街角 (事件・パラレル) — engine拡張 wave#2 cluster2 (ability-presence filter)
// rules: 01-victory-conditions.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト (B08094 と同一効果。P 版は rarity/imageUrl/no のみ異なる — TSV ct-p08/case.tsv で
// effect/qAndA 完全一致を再確認済。case のため cutIn/hirameki/henso 列なし)。full def 別ファイル慣行 (B04068P)。
//
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。
//     その中から【現場リムーブ時】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//     この能力は自分の現場に〚カード名［シェリー］〛か〚［灰原哀］〛がいる場合に宣言できる。
//
// 句マッピングは B08094.ts と同一 (header 参照)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always', // 事件カードは case area 所在 → case:to-resolved hook + selfOnly で gate
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true, // 自分の事件カードが解決編になったときのみ発火 (相手の事件には誤発火しない)
  },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

// a2: 【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛 →
//     deck-look3 で【現場リムーブ時】持ちキャラ1枚まで手札 → 残りデッキ下。
//     宣言可条件 = 自分の現場に[シェリー]か[灰原哀] がいる。
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  // 事件カードは case area 所在 → 'on-scene' だと declared 列挙で弾かれるため 'always'。
  scope: 'always',
  // 【解決編】 + 宣言可条件 (現場に[シェリー]/[灰原哀]) を and で結合 (rules/21 宣言ゲート)。
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' },
      {
        kind: 'sceneHas',
        query: { area: 'scene', side: 'self', filter: { cardName: ['シェリー', '灰原哀'] } },
      },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  // 〚裏向きの証拠を2つ表向きにする〛(コスト) — 自分の証拠のみ / 好きな場所を選べる (TSV qAndA)
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のデッキのカードを上から3枚見る → その中から【現場リムーブ時】を持つキャラを1枚まで公開
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo', // 「1枚まで」=0枚可 (TSV qAndA「加えないことは可能」)
          player: 'self',
          filter: { keyword: '現場リムーブ時', kind: 'character' }, // ability-presence filter (印字静的判定)
          maxN: 3,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      // 公開して手札に加え (取得した場合のみ)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' } },
      },
      // 残りを好きな順番でデッキの下に移す
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。その中から【現場リムーブ時】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。この能力は自分の現場に〚カード名［シェリー］〛か〚［灰原哀］〛がいる場合に宣言できる。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B08094P: CardDef = {
  id: 'B08094P',
  no: '0930/B08094P',
  kind: 'case',
  names: ['裏切りの街角'],
  colors: ['青', '黒'],
  traits: [],
  rarity: 'RP',
  imageUrl: '1770878999196292.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
