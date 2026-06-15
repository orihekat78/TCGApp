// cards/ct-p09/B09010P 阿笠博士 (キャラ, パラレル) — engine拡張 wave#2 cluster14 (multi-card sceneEnter, 2026-06-15)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト (B09010 と同一):
//   【FILE6】【宣言】【スリープ】：自分のリムーブエリアにある、レベル4のそれぞれカード名の異なる
//   〚特徴［少年探偵団］〛のキャラを2枚まで選び、登場させる。自分のFILEエリアにあるカードを上から1枚リムーブする。
//
// 句マッピングは B09010 を参照 (同一 ability)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'fileAtLeast', n: 6 }, // 【FILE6】
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }] }, // 【スリープ】
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', from: 'remove', cardIds: '$pick.cardIds', skipResolvesAtom: true, viaEffect: true,
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団', levelMin: 4, levelMax: 4 }, distinctNames: true },
            n: { min: 0, max: 2 }, chooser: 'self',
          },
        },
      },
      { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【FILE6】【宣言】【スリープ】：リムーブのレベル4・カード名相異[少年探偵団]を2枚まで登場し、FILE上から1枚リムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

export const B09010P: CardDef = {
  id: 'B09010P',
  no: '0955/B09010P',
  kind: 'character',
  names: ['阿笠博士'],
  colors: ['青'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['発明家'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1775608802666585.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
