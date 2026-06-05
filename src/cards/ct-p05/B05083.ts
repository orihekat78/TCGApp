// cards/ct-p05/B05083 太閤名人の将棋盤 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：自分のリムーブエリアにある〚特徴［赤井家］〛のキャラを1枚まで選び、手札に加える。この能力は自分のFILEエリアにあるカードが5枚以下で、自分の現場に〚特徴［赤井家］〛のキャラが3枚以上いる場合に宣言できる。
//
// 先攻7 / 後攻6 (rules/01) — caseLevel は先攻基準。
// a1: inline triggered — 解決編 (case:to-resolved hook) になったとき discard self n=1 (D08026 a1 同型)
// a2: inline declared — 〚証拠3つ表向き〛コストで リムーブの[赤井家]を1枚まで手札に加える (FILE5以下 & 現場[赤井家]3+ で宣言可)

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。(D08026 a1 同型)
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always', // 事件カードは case area 所在 → case:to-resolved hook + selfOnly で gate
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true, // 自分の事件カードが解決編になったときのみ発火
  },
  // この事件が解決編になったとき、自分は手札を1枚リムーブする。
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

// a2: 【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛コストで
//     リムーブエリアの 特徴[赤井家] を1枚まで手札に加える。
//     宣言条件: caseStatus 解決編 / FILE 5枚以下 (= not fileAtLeast 6) / 現場[赤井家]3枚以上。
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  // 事件カードは case area 所在 → 'on-scene' だと declared 列挙で弾かれるため 'always'。
  scope: 'always',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' }, // 【解決編】
      // 自分のFILEエリアにあるカードが5枚以下 (= 6枚以上ではない)
      { kind: 'not', c: { kind: 'fileAtLeast', n: 6 } },
      // 自分の現場に[赤井家]のキャラが3枚以上いる
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '赤井家' } }, nMin: 3 },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } }, // 〚裏向きの証拠を3つ表向きにする〛
  // 自分のリムーブエリアにある[赤井家]のキャラを1枚まで選び、手札に加える。
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: '赤井家' } } },
  description: '【解決編】【宣言】【ターン1】〚裏向き証拠3つ表向き〛: リムーブの[赤井家]を1枚まで手札に加える (FILE5以下 & 現場[赤井家]3+)。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05083: CardDef = {
  id: 'B05083',
  no: '0583/B05083',
  kind: 'case',
  names: ['太閤名人の将棋盤'],
  colors: ['赤'],
  traits: [],
  rarity: 'C',
  imageUrl: '1745322226173614.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
