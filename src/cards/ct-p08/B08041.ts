// cards/ct-p08/B08041 高橋良一 (character) — attribution mini-wave ② costPaid (removeSetCard kind 分岐)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//   【宣言】【ターン1】〚このキャラに裏向きでセットされているカードを1枚リムーブする〛：この【宣言】能力の
//     コストによってキャラがリムーブされた場合、ターン終了時までこのキャラをAP＋2000する。イベントが
//     リムーブされた場合、ターン終了時までこのキャラをLP＋1する。
//
// a1: 【登場時】デッキ上1枚をこのキャラに裏向きセット = charSetCard{uid:'$self', fromDeckTop:true}
//     (B08033 a1 と同 verb。あちらは forEach で「現場キャラ1枚につき」だがこちらは単発1枚 → 素の atom)
//     engine 根拠: 単発 charSetCard は src/cards/ct-d08/D08021 a1 等で shipped。
// a2: 【宣言】【ターン1】cost removeSetCard{n:1} → コストで除去した裏向きセットカードの kind で分岐。
//     costRemovedMatches{key:'removeSetCard'} = attribution mini-wave (cond/eval.ts:337-352、既定
//     'removeDeckTop' → key 明示で ctx.costPaid['removeSetCard'] 読替え。書込み側 = cost/pay.ts:270-299
//     `{ ids, kinds }`)。filter.kind は matchOneFilter(c=null=印字値) が honor (cond/eval.ts:584)。
//     効果は「このキャラ」= 自身 → charModifyAP/LP{uid:'$self', scope:'turn'} (D01003 a1 同型)。
//     removeSetCard は 1 枚のみゆえ char/event どちらか一方の branch のみ発火 (2 conditional を sequence)。
//     costRemovedMatches 消費者 exemplar: src/cards/ct-p03/B03003.ts, src/cards/ct-p04/B04077.ts。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  // 自分のデッキのカードを上から1枚裏向きでこのキャラにセットする
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      uid: '$self',
      fromDeckTop: true,
      faceUp: false,
      player: 'self'
    }
  },
  description: '【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: {
    kind: 'turn',
    n: 1
  },
  // 〚このキャラに裏向きでセットされているカードを1枚リムーブする〛
  // hostSelf: 「このキャラに」= host を自身に限定 (attribution mini-wave 追加 param。
  // 未指定だと B08033「現場にいるキャラに」同様 自陣全キャラ走査になり印字より広い — semantic lens 指摘)
  cost: {
    kind: 'removeSetCard',
    n: 1,
    hostSelf: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      // コストによってキャラがリムーブされた場合、ターン終了時までこのキャラをAP＋2000する
      {
        kind: 'conditional',
        if: {
          kind: 'costRemovedMatches',
          key: 'removeSetCard',
          filter: {
            kind: 'character'
          }
        },
        then: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$self',
            delta: 2000,
            scope: 'turn'
          }
        }
      },
      // イベントがリムーブされた場合、ターン終了時までこのキャラをLP＋1する
      {
        kind: 'conditional',
        if: {
          kind: 'costRemovedMatches',
          key: 'removeSetCard',
          filter: {
            kind: 'event'
          }
        },
        then: {
          kind: 'atom',
          verb: 'charModifyLP',
          args: {
            uid: '$self',
            delta: 1,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '【宣言】【ターン1】〚このキャラに裏向きでセットされているカードを1枚リムーブする〛：この【宣言】能力のコストによってキャラがリムーブされた場合、ターン終了時までこのキャラをAP＋2000する。イベントがリムーブされた場合、ターン終了時までこのキャラをLP＋1する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08041: CardDef = {
  id: 'B08041',
  no: '0880/B08041',
  kind: 'character',
  names: [
    '高橋良一'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '食品会社社員'
  ],
  rarity: 'C',
  imageUrl: '1770731222600747.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
