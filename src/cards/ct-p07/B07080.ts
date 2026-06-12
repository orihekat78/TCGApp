// cards/ct-p07/B07080 風見裕也 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。
//   【パートナー黄】【FILE5】【宣言】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを
//     1枚デッキの下に移す〛：キャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true} (B02040 a1 同型)
//   - レベル7以下のキャラを1枚まで選び、リムーブする => sceneRemove PA短縮形
//     {player:'self', max:1, side:'either', filter:{levelMax:7}} (rules/15: エリア指定なし=どちらの現場、「〜まで」=0枚可)
//   - 【パートナー黄】【FILE5】 => condition and[partnerColor 黄, fileAtLeast 5]
//     (rules/17: 条件未達=能力を持たない扱い。FILE はアシスト中パートナー込み = 公式Q&A・eval.ts fileAtLeast 準拠)
//   - 【宣言】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛 =>
//     type:'declared' + cost pay[sleepSelf, sceneToDeckBottom (Task D E2-b)]。rules/21「自分の」省略 +
//     公式Q&A「相手のキャラは移せない」 → query side:'self'。デッキ下移動はリムーブでない (rules/23 流儀、
//     scene.toDeck 経由で leave:to-remove 不発火)
//   - キャラを1枚まで選び、リムーブする => sceneRemove {player:'self', max:1, side:'either'} (フィルタなし、自身も選択可)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // レベル7以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } } },
  description: '【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー黄】【FILE5】 (rules/17。FILE はアシスト中のパートナーも数える = 公式Q&A)
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'fileAtLeast', n: 5 }] },
  // 【スリープ】+〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛
  // (rules/21「自分の」省略 → side:'self'。公式Q&A: コストでは相手のキャラを移せない。1枚必須 = 払えなければ宣言不可)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { levelMax: 7, trait: '警視庁' } }, n: { min: 1, max: 1 }, chooser: 'owner' }, n: 1 },
    ],
  },
  // キャラを1枚まで選び、リムーブする (エリア指定なし=どちらの現場でも / 自身も選択可 / 0枚可)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect' } },
  description: '【パートナー黄】【FILE5】【宣言】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛：キャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/23-qa-disguise-cutin.md'],
};

export const B07080: CardDef = {
  id: 'B07080',
  no: '0808/B07080',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1759154512423232.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
