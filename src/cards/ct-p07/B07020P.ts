// cards/ct-p07/B07020P 綾小路文麿 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のリムーブエリアにあるレベル5以下の〚カード名［マロちゃん］〛かレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。
// 句マッピング:
//   - 【宣言】 => ability.type 'declared' [src/cards/ct-p07/B07031.ts a2 と ct-p01/B01088.ts a1 が type 'declared'。capability-map COST_KIND_MAP / brief DSL規約「【宣言】= declared:true + cost」。canDeclaredAbility が cost を canPay でゲートする。]
//   - 【スリープ】〚手札を1枚リムーブする〛 (コスト) => cost:{kind 'pay',items:[{kind 'sleepSelf'},{kind 'removeFromHand',target:{pick hand/self n1},n:1}]} [B01088.ts a1 cost と B07031.ts a2 cost が byte 同型 (sleepSelf + removeFromHand hand/self n:1)。src/engine/cost/evaluate.ts COST_KIND_MAP に sleepSelf/removeFromHand/pay 登録、canPay の pay は items.every(canPay) で両方払えねば宣言不可 (rules/21)。pay.ts payInner が sleepSelf=setState 'sleep'、removeFromHand=discardToRemove を実行。]
//   - 自分のリムーブエリアにある…キャラを1枚まで選び、登場させる => atom sceneEnter {player:'self', from:'remove', cardId:'$pick.cardId', viaEffect:true, target:{pick area:'remove' side:'self' n:{min:0,max:1}}} [B07031.ts a2 reanimate ステップが from:'remove' + cardId:'$pick.cardId' + viaEffect:true + target pick(area:remove,side:self,n:{min:0,max:1}) を使用。capability-map L33 sceneEnter は from:'remove' source-area splice をサポート、unresolved cardId なしの場合 await pick。「1枚まで」= n.min:0 (0枚可, rules/15 / brief 量指定子)。]
//   - レベル5以下の〚カード名［マロちゃん］〛 か レベル5以下の〚特徴［警察］〛 (OR フィルタ) => query.filterAny:[{cardName:'マロちゃん',levelMax:5,kind 'character'},{trait:'警察',levelMax:5,kind 'character'}] [src/cards/ct-p02/B02004.ts と ct-d08/D08024.ts が filterAny の OR (cardName/trait + levelMax) を使用。src/engine/target/candidates.ts L239-242 が query.filterAny.some(matchOneFilter)=OR を honor。filter フィールド cardName(L260 split-name)/trait(L268)/levelMax(L320-321)/kind(L291) すべて評価。src/engine/types/effect.ts L118 query.filterAny?:TargetFilter[]。resolve-picks.ts L113-122 も filterAny を解決経路に通す。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'removeFromHand',
        target: {
          kind: 'pick',
          query: {
            area: 'hand',
            side: 'self'
          },
          n: {
            min: 1,
            max: 1
          },
          chooser: 'self'
        },
        n: 1
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      cardId: '$pick.cardId',
      viaEffect: true,
      target: {
        kind: 'pick',
        query: {
          area: 'remove',
          side: 'self',
          filterAny: [
            {
              cardName: 'マロちゃん',
              levelMax: 5,
              kind: 'character'
            },
            {
              trait: '警察',
              levelMax: 5,
              kind: 'character'
            }
          ]
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のリムーブエリアにあるレベル5以下の〚カード名［マロちゃん］〛かレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B07020P: CardDef = {
  id: 'B07020P',
  no: '0752/B07020P',
  kind: 'character',
  names: [
    '綾小路文麿'
  ],
  colors: [
    '緑'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '京都府警'
  ],
  rarity: 'CP',
  imageUrl: '1763546798333000.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ],
};
