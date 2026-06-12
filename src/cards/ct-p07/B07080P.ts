// cards/ct-p07/B07080P 風見裕也 (キャラ, パラレル SRP) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
//
// B07080 のパラレル (SRP)。公式テキスト・Q&A は B07080 と同一。id / no / rarity / imageUrl のみ P 版データ。
//
// 公式テキスト:
//   【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。
//   【パートナー黄】【FILE5】【宣言】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを
//     1枚デッキの下に移す〛：キャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}
//   - レベル7以下のキャラを1枚まで選び、リムーブする => sceneRemove PA短縮形 {player:'self', max:1, side:'either', filter:{levelMax:7}}
//   - 【パートナー黄】【FILE5】 => condition and[partnerColor 黄, fileAtLeast 5] (rules/17、FILE はアシスト中パートナー込み)
//   - 【宣言】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛 =>
//     declared + cost pay[sleepSelf, sceneToDeckBottom side:'self'] (rules/21 + 公式Q&A: 相手キャラ不可)
//   - キャラを1枚まで選び、リムーブする => sceneRemove {player:'self', max:1, side:'either'}

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
  // (rules/21「自分の」省略 → side:'self'。公式Q&A: コストでは相手のキャラを移せない)
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

export const B07080P: CardDef = {
  id: 'B07080P',
  no: '0808/B07080P',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'SRP',
  imageUrl: '1763546825821225.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
