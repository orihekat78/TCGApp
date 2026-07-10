// cards/ct-p08/B08068 安室透 (character) — attribution mini-wave ② costPaid (revealFromHand count 合成 dyn)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【スリープ】〚手札から特徴［喫茶ポアロ］のキャラを好きな枚数公開する〛：この【宣言】能力の
//     コストによって公開した枚数と、自分の現場にいる〚特徴［喫茶ポアロ］〛のキャラの枚数の合計以下の
//     レベルのキャラを1枚まで選び、リムーブする。
//
// cost: 【スリープ】= sleepSelf / 〚手札から特徴［喫茶ポアロ］のキャラを好きな枚数公開する〛=
//   revealFromHand{target pick hand side:self filter{trait:'喫茶ポアロ', kind:'character'}, n:{min:0,max:99}}。
//   「好きな枚数」= 0 枚可 (公式Q&A「1枚も公開せずに宣言できます」= min:0)。revealFromHand cost は
//   src/cards/ct-p06/B06004.ts a2 が exemplar (target=pick hand + cost.n)。n の {min,max} 拡張 =
//   attribution mini-wave (evaluate.ts:72 canPay は min 基準 / pay.ts:110-130 は picked を max まで採用、
//   costPaid['revealFromHand'] = { ids, count } を書込む)。hand-pick は kind:'character' 明示 (BUG-123)。
// effect: 「公開した枚数 + 現場の喫茶ポアロ枚数」の合計以下レベルのキャラを1枚まで選びリムーブ。
//   sceneRemove{max:1, side:'either', filter:{levelMax dyn}} (D08003 a1 の sceneRemove 短形 + levelMax を
//   dyn 化)。dyn = '$cost.revealFromHand.count + $self.sceneTrait.喫茶ポアロ' (dyn/eval.ts:597 resolveCost
//   の $cost.<key>.<path> + dyn/eval.ts:320 $self.sceneTrait.<trait>、四則演算は dyn/eval.ts:65-)。
//   nested-filter-dyn (levelMax:{dyn}) は src/cards/ct-d01/D01014.ts a1 (sceneEnter levelMax:{dyn}) が
//   shipped exemplar。「1枚まで選び」= max:1 (0 可、rules/15)。対象は側指定なし → side:'either' (rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      // 【スリープ】
      {
        kind: 'sleepSelf'
      },
      // 〚手札から特徴［喫茶ポアロ］のキャラを好きな枚数公開する〛
      {
        kind: 'revealFromHand',
        target: {
          kind: 'pick',
          query: {
            area: 'hand',
            side: 'self',
            filter: {
              trait: '喫茶ポアロ',
              kind: 'character'
            }
          },
          n: {
            min: 0,
            max: 99
          },
          chooser: 'self'
        },
        n: {
          min: 0,
          max: 99
        }
      }
    ]
  },
  // 公開した枚数 + 現場の[喫茶ポアロ]枚数 の合計以下レベルのキャラを1枚まで選び、リムーブする
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      filter: {
        levelMax: {
          dyn: '$cost.revealFromHand.count + $self.sceneTrait.喫茶ポアロ'
        }
      }
    }
  },
  description: '【宣言】【スリープ】〚手札から特徴［喫茶ポアロ］のキャラを好きな枚数公開する〛：この【宣言】能力のコストによって公開した枚数と、自分の現場にいる〚特徴［喫茶ポアロ］〛のキャラの枚数の合計以下のレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08068: CardDef = {
  id: 'B08068',
  no: '0905/B08068',
  kind: 'character',
  names: [
    '安室透'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'C',
  imageUrl: '1770731255732811.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
