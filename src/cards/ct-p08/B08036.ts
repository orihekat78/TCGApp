// cards/ct-p08/B08036 クリス・ヴィンヤード (character) — engine mega-wave W1 exemplar (charSetCard cardIds remove-source, 2026-07-03)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】：自分のリムーブエリアにある〚カード名［工藤有希子］〛を1枚まで選び、
//   裏向きでこのキャラにセットする。セットした場合、レベル7以下のキャラを1枚まで選び、デッキの下に移す。
//   【ヒラメキ】キャラを1枚まで選び、スリープさせる。
//
// a1: 【宣言】cost sleepSelf。effect = chain:
//   step1 = charSetCard cardIds 契約 (W1 新分岐): remove から〚工藤有希子〛を pick → $self へ裏向きセット。
//     charStackCard の source-splice 契約と同型。0枚 pick は chainStepNoApply → step2 不実行
//     (「セットした場合」rules/15)。
//   step2 = sceneToDeck 短縮形 {levelMax:7, max:1, side:'either', pos:'bottom'} (B03059 系「デッキの下に移す」)。
// a2: 【ヒラメキ】= D01012 a2 同型 (sceneSetState sleep pick 0..1)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' }, // 【スリープ】
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: {
          uid: '$self', // このキャラにセット
          cardIds: '$pick.cardIds',
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', cardName: '工藤有希子' } },
            n: { min: 0, max: 1 }, // 「1枚まで」= 0可 (rules/15)
            chooser: 'self',
          },
        },
      },
      // セットした場合 (chain gate)、レベル7以下のキャラを1枚まで選び、デッキの下に移す
      { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, pos: 'bottom', filter: { levelMax: 7 } } },
    ],
  },
  description:
    '【宣言】【スリープ】自分のリムーブエリアにある〚カード名[工藤有希子]〛を1枚まで選び、裏向きでこのキャラにセットする。セットした場合、レベル7以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  // キャラを1枚まで選び、スリープさせる (D01012 a2 同型)
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B08036: CardDef = {
  id: 'B08036',
  no: '0875/B08036',
  kind: 'character',
  names: ['クリス・ヴィンヤード'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731222566500.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
