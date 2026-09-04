// cards/ct-p09/B09050 白馬探 (character) — attribution mini-wave ② costPaid (removeFromHand.level → dyn levelMax)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚手札を1枚リムーブする〛：この【宣言】能力のコストによってリムーブしたカードのレベル以下の
//   レベルの〚特徴［探偵］〛のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、
//   代わりにスリープさせる）
//
// 句マッピング:
//   - 【宣言】【ターン1】 => type:'declared' + limit{kind:'turn', n:1}
//   - 〚手札を1枚リムーブする〛 => cost pay[removeFromHand{target pick hand self (filter 無=任意札) n{1,1} chooser self, n:1}]
//       (D02013 a1 removeFromHand cost VERBATIM。「手札を1枚」= filter 無し。canPay = 手札1枚以上で成立。
//        pay が ctx.costPaid['removeFromHand']={ids, level:離脱直前の実効値} を記録、cost/pay.ts)
//   - リムーブしたカードのレベル以下のレベルの〚特徴［探偵］〛のキャラを1枚まで選び =>
//       sceneSetState pick {side:'either', filter:{trait:'探偵', levelMax:{dyn:'$cost.removeFromHand.level'}}, n{0,1}}
//       ($cost.removeFromHand.level = dyn/eval.ts:597 generic drillDown。filter 内 {dyn} は resolve-picks.ts:140
//        resolveFilterDynObj が pick 解決時に literal 化。エリア指定なし=either、「1枚まで」=0枚可 rules/15。
//        Q&A「効果解決時点の（増減後）レベルを参照」= cost支払い直前snapshotを後続dynが読む)
//   - スタンさせる => sceneSetState{state:'stun'} (D03002/B06078 a2 の $pick+target 形。
//        rules/24: スタン状態は3つ目の状態、以後アクティブ化は代わりにスリープ = engine mutate.scene.setState('stun') が担保)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  cost: {
    kind: 'removeFromHand',
    target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
    n: 1,
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'stun',
      // リムーブしたカードのレベル以下 (levelMax = 除去札の印字レベル) の探偵キャラを1枚まで
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either',
          filter: { trait: '探偵', levelMax: { dyn: '$cost.removeFromHand.level' } },
        },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description:
    '【宣言】【ターン1】〚手札を1枚リムーブする〛：この【宣言】能力のコストによってリムーブしたカードのレベル以下のレベルの〚特徴［探偵］〛のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};

export const B09050: CardDef = {
  id: 'B09050',
  no: '0993/B09050',
  kind: 'character',
  names: ['白馬探'],
  colors: ['白'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608856205539.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
