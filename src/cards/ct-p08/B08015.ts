// cards/ct-p08/B08015 若狭留美 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   自分のターン終了時、自分の現場に〚カード名［灰原哀］〛がいる場合、このキャラをアクティブにする。
//   【宣言】【スリープ】：カードを1枚引き、手札を1枚リムーブする。
//
// a1: 自分のターン終了時 (phase:end:start hook, turn:self) → 現場に[灰原哀]がいる場合 このキャラをアクティブに
//     (D08003 a2 同型の phase:end:start triggered + conditional + sceneSetState active $self)。
// a2: 【宣言】【スリープ】: 1ドロー → 手札1リム (cost sleepSelf, sequence draw + discard)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分の現場に[灰原哀]がいる場合
    if: { kind: 'bond', cardName: '灰原哀' },
    // このキャラをアクティブにする
    then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  },
  description: '自分のターン終了時、現場に[灰原哀]がいる場合、このキャラをアクティブにする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】(もともと sleep / stun なら canPay=false で宣言不可)
  cost: { kind: 'sleepSelf' },
  // カードを1枚引き、手札を1枚リムーブする
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【宣言】【スリープ】：カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/21-declared-ability-cost.md'],
};

export const B08015: CardDef = {
  id: 'B08015',
  no: '0856/B08015',
  kind: 'character',
  names: ['若狭留美'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['教師'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731204394683.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
