// cards/ct-p07/B07031 小泉紅子 (character) — 赤魔術 trait family残 (engine変更0)
// rules: 11-reasoning.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//   【事件赤魔術】【宣言】【スリープ】〚手札を1枚リムーブする〛：キャラを1枚まで選び、リムーブする。
//     自分の現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブしてもよい。
//     そうした場合、自分のリムーブエリアにあるレベル3以下の【白】のキャラを1枚まで選び、登場させる。
// 公式Q&A:
//   - 【事件赤魔術】= 自分の事件が特徴［赤魔術］を持つ場合に有効。
//   - セットカードはキャラ2枚から1枚ずつリムーブ可 (合わせて2枚 = own scene の set card を計2枚)。
//   - キャラを選ばず(リムーブせず)以降を解決可 / キャラをリムーブしセットをリムーブしないことも可。
//   - 【宣言】コスト「手札を1枚リムーブ」は自分のカードのみ (rules/21)。
//
// 句マッピング (certify: equivalent / high — 全句 certified exemplar と意味等価):
//   - a1 【登場時】このキャラにデッキ上端を裏向きセット = charSetCard{uid:'$self', fromDeckTop, faceUp:false} (B08054 a2 同型)。
//   - a2 【事件赤魔術】【宣言】【スリープ】〚手札1枚リムーブ〛:
//     · condition = caseTrait{赤魔術} (B07062 が caseTraits:[赤魔術])。declared gate (canDeclaredAbility evalCond)。
//     · cost = pay[sleepSelf, removeFromHand(hand,self,n:1)] (B01088 完全同型。両方払えねば宣言不可 rules/21)。
//     · clause1「キャラを1枚まで選びリムーブ」= sceneRemove{self, max:1, side:'either'} filter無 (任意キャラ・0枚可 rules/15)。
//     · clause2「合わせて2枚リムーブしてもよい。そうした場合、reanimate」=
//       optional{ chain[ charRemoveSetCard{self, side:self, n:2, filter:hasSetCards}, sceneEnter-reanimate ] }
//       (B07055 a1 の charRemoveSetCard n:2 + B07058 a1 の reanimate を合成)。
//       · 「してもよい」= optional / 「合わせて2枚」= n:2 (number=強制ちょうど2枚。n:{min,max} object は無音0枚の既知挙動)。
//       · 「そうした場合」= chain (2枚除去後のみ reanimate へ進む)。
//       · reanimate = sceneEnter{from:remove, filter{色白, levelMax3, character}, n:0-1} (「1枚まで」=0OK)。
//         登場した「そのキャラ」の【登場時】も発動 (rules/15、本カードを reanimate すれば a1 が再 set)。
//   - known-gap (family 共通・非本カード起因): charRemoveSetCard n:2 は AI 経路で候補<2 のとき clamp し
//     1枚のみ除去でも chain が reanimate へ進みうる (B07055 と同一構造、DEFERRED-INDEX 記録済)。HUMAN 経路は per-uid で計2枚正。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【登場時】自分のデッキ上端を裏向きでこのキャラ自身にセット (B08054 a2 同型)。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
  description: '【登場時】自分のデッキ上端を裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

// a2: 【事件赤魔術】【宣言】【スリープ】〚手札1枚リムーブ〛 → キャラ1枚までリムーブ + (任意) セット2枚除去で reanimate。
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【事件赤魔術】(自分の事件が特徴[赤魔術]を持つ場合に有効)
  condition: { kind: 'caseTrait', trait: '赤魔術' },
  // 【スリープ】〚手札を1枚リムーブする〛 (両コスト合成 / 一部でも払えねば宣言不可) — B01088 同型
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      // キャラを1枚まで選び、リムーブする (filter無=任意キャラ、side:either、0枚可)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either' } },
      // 自分の現場のセットカードを合わせて2枚リムーブしてもよい。そうした場合、リムーブのレベル3以下[白]を1枚まで登場
      {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'self', n: 2, filter: { hasSetCards: true } } },
            {
              kind: 'atom',
              verb: 'sceneEnter',
              args: {
                player: 'self',
                from: 'remove',
                cardId: '$pick.cardId',
                viaEffect: true,
                target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '白', levelMax: 3, kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' },
              },
            },
          ],
        },
      },
    ],
  },
  description:
    '【事件赤魔術】【宣言】【スリープ】〚手札1枚リムーブ〛：キャラを1枚までリムーブ。自分の現場のセットカードを計2枚リムーブしてもよい。そうした場合、リムーブのレベル3以下[白]を1枚まで登場。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

export const B07031: CardDef = {
  id: 'B07031',
  no: '0760/B07031',
  kind: 'character',
  names: ['小泉紅子'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['高校生', '魔女'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1759154512399017.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
