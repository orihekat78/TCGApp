// cards/ct-p07/B07031P 小泉紅子 (character・パラレル) — B3-1 conflict canonical 化で unlock (engine変更0)
// rules: 11-reasoning.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト (B07031 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる):
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//   【事件赤魔術】【宣言】【スリープ】〚手札を1枚リムーブする〛：キャラを1枚まで選び、リムーブする。
//     自分の現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブしてもよい。
//     そうした場合、自分のリムーブエリアにあるレベル3以下の【白】のキャラを1枚まで選び、登場させる。
// 句マッピングは B07031.ts と同一 (同テキスト別ファイル full def 慣行 — B07047P / B03066P 同様)。
// 「裏向きでセット」限定・物理 occurrence・exact 2枚の契約は B07031 と同一。

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
            { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'self', n: 2, minimumPolicy: 'exact', faceDownOnly: true, filter: { hasSetCards: true } } },
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

export const B07031P: CardDef = {
  id: 'B07031P',
  no: '0760/B07031P',
  kind: 'character',
  names: ['小泉紅子'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['高校生', '魔女'],
  keywords: [],
  rarity: 'SRP',
  imageUrl: '1763546809866812.jpg',
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
