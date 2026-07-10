// cards/ct-p07/B07025 星河童吾 (character) — m2-attribution costPaid② (engine変更0)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚現場にいるこのキャラ以外の特徴［マジシャン］のキャラを1枚デッキの下に移す〛：
//     自分のリムーブエリアにある、この【宣言】能力のコストによってデッキの下に移したキャラのレベル以下の
//     レベルの〚特徴［マジシャン］〛のキャラを1枚まで選び、手札に加える。
//   Q：【宣言】能力の「～キャラを1枚デッキの下に移す」は、相手のキャラを移すことができますか？
//   A：いいえ。コストでは自分のカードしか使えません (rules/21「自分の」省略)。
//
// 句マッピング:
//   a1: 【宣言】 (declared、【ターン1】無し = limit 無し) => type:'declared'
//     【スリープ】 (コスト①: 自身スリープ rules/21) => cost.items[0] = { kind:'sleepSelf' }
//     〚現場にいるこのキャラ以外の特徴[マジシャン]のキャラを1枚デッキの下に移す〛 (コスト②) =>
//       cost.items[1] = { kind:'sceneToDeckBottom',
//         target:{ kind:'pick', query:{ area:'scene', side:'self', filter:{trait:'マジシャン'}, excludeSelf:true },
//                  n:{min:1,max:1}, chooser:'owner' }, n:1 }
//       [「自分の」省略 => side:'self' (rules/21、公式Q&A 相手キャラ不可)。「このキャラ以外」=> query.excludeSelf:true
//        (src/engine/target/candidates.ts:341 が query.excludeSelf && cand.uid===ctx.source.uid で除外。
//         D01003 a1「このキャラ以外」exemplar と同型)。デッキ下移動はリムーブでない rules/09。
//        cost 全体は B07079.ts a1 の {sleepSelf + sceneToDeckBottom pick} 同型。
//        pay.ts:210 が costPaid['sceneToDeckBottom'] = { ids, level: readDef.card(ids[0]).level } を書込む]
//     「…コストによってデッキの下に移したキャラのレベル以下のレベルの[マジシャン]のキャラを1枚まで選び、手札に加える」=>
//       effect = atom 'handAddFromRemove' short-form { player:'self', max:1,
//         filter:{ trait:'マジシャン', levelMax:{dyn:'$cost.sceneToDeckBottom.level'}, kind:'character' } }
//       [リムーブエリア => handAddFromRemove short-form (defaultArea='remove'、B01030/B06065 exemplar)。
//        「レベル以下のレベル」=> levelMax:{dyn:'$cost.sceneToDeckBottom.level'}
//         (dyn/eval.ts:8,285,599-609 が $cost.<key>.<path> drillDown で costPaid を読む。
//          resolve-picks.ts:339-346 resolveTargetFilterDyn が pick 列挙前に levelMax dyn を ctx.costPaid から
//          具体値へ解決。B02072 の levelMax:{dyn} filter 同型)。
//        「〜1枚まで選び」=> max:1 (short-form → n.min:0/n.max:1 = 0枚可 rules/15)。
//        「特徴[マジシャン]のキャラ」=> filter.trait:'マジシャン' + kind:'character' (キャラ明示、candidates.ts:492 levelMax)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】〚現場にいるこのキャラ以外の特徴[マジシャン]のキャラを1枚デッキの下に移す〛(コスト全部実行 rules/21)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'sceneToDeckBottom',
        target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: 'マジシャン' }, excludeSelf: true }, n: { min: 1, max: 1 }, chooser: 'owner' },
        n: 1,
      },
    ],
  },
  // 自分のリムーブエリアにある、移したキャラのレベル以下の[マジシャン]のキャラを1枚まで選び、手札に加える
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: { trait: 'マジシャン', levelMax: { dyn: '$cost.sceneToDeckBottom.level' }, kind: 'character' },
    },
  },
  description: '【宣言】【スリープ】〚現場にいるこのキャラ以外の特徴［マジシャン］のキャラを1枚デッキの下に移す〛：自分のリムーブエリアにある、この【宣言】能力のコストによってデッキの下に移したキャラのレベル以下のレベルの〚特徴［マジシャン］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07025: CardDef = {
  id: 'B07025',
  no: '0757/B07025',
  kind: 'character',
  names: ['星河童吾'],
  colors: ['緑'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['マジシャン'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413994198847.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
