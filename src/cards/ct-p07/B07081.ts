// cards/ct-p07/B07081 安室透 (キャラ) — Task D batch (2026-06-12)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】自分のリムーブエリアにあるレベル1以下の【黄】のイベントを1枚まで選び、手札に加える。
//     カードを手札に加え、自分の手札が6枚以上ある場合、手札を1枚リムーブする。
//   【パートナー黄】【宣言】【ターン1】【スリープ】：レベル8以下のキャラを1枚まで選び、リムーブする。
//     この能力は自分の現場にこのキャラ以外の〚特徴［喫茶ポアロ］〛のキャラがいる場合に宣言できる。
//
// a1: 【登場時】(enter selfOnly)。「…手札に加える。カードを手札に加え、…場合」= chain:
//     step1 handAddFromRemove (黄・レベル1以下・イベント、1枚まで = max:1。0枚選択なら chain break =
//     「カードを手札に加え」不成立で後半は実行されない — D08003 chain 同型 / B02053 a2 filter 同型) /
//     step2 conditional(handAtLeast 6 self → discard 1) — Task D E1 handAtLeast。
//     「6枚以上」は加えた後の step 実行時評価 (rules/15 解決時参照、task-d/01 edge case #3)
// a2: 【パートナー黄】+ 宣言ゲート「この能力は自分の現場にこのキャラ以外の〚特徴［喫茶ポアロ］〛のキャラが
//     いる場合に宣言できる」= condition and[partnerColor 黄, sceneHas(trait 喫茶ポアロ, excludeSelf)]
//     (canDeclaredAbility が宣言時に評価 = rules/21、B04047 a1 の宣言ゲート同型) +
//     【ターン1】limit + 【スリープ】sleepSelf cost → レベル8以下のキャラを1枚まで sceneRemove (B04047 a1 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 自分のリムーブエリアにあるレベル1以下の【黄】のイベントを1枚まで選び、手札に加える (0枚なら後半不成立 = chain break)
      { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { color: '黄', levelMax: 1, kind: 'event' } } },
      {
        kind: 'conditional',
        // カードを手札に加え、自分の手札が6枚以上ある場合 (加えた後の解決時評価)
        if: { kind: 'handAtLeast', player: 'self', n: 6 },
        // 手札を1枚リムーブする
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】自分のリムーブエリアにあるレベル1以下の【黄】のイベントを1枚まで選び、手札に加える。カードを手札に加え、自分の手札が6枚以上ある場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 【パートナー黄】かつ「自分の現場にこのキャラ以外の〚特徴［喫茶ポアロ］〛のキャラがいる場合に宣言できる」
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '喫茶ポアロ' }, excludeSelf: true }, nMin: 1 }] },
  // 【スリープ】コスト (このキャラ自身をスリープ)
  cost: { kind: 'sleepSelf' },
  // レベル8以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 8 } } },
  description:
    '【パートナー黄】【宣言】【ターン1】【スリープ】：レベル8以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場にこのキャラ以外の〚特徴［喫茶ポアロ］〛のキャラがいる場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07081: CardDef = {
  id: 'B07081',
  no: '0809/B07081',
  kind: 'character',
  names: ['安室透'],
  colors: ['黄'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '喫茶ポアロ'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762414027341106.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
