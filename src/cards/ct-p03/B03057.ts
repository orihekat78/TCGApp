// cards/ct-p03/B03057 槍田郁美 (character) — engine mega-wave W2 exemplar (untargetableByAction + ability:declared hook, 2026-07-03)
// rules: 03-field-areas.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   このキャラがスリープ状態の場合、相手の現場にいるキャラはこのキャラを指定してアクションできない。
//   【ターン1】自分の現場にいる〚特徴［探偵］〛のキャラが【宣言】能力を使用したとき、カードを1枚引き、手札を1枚リムーブする。
//
// a1: 「スリープ状態の場合」= continuous condition{charStateIs $self sleep} (rules/24 常時有効型:
//     条件成立中のみ。スタン状態は sleep でないため不成立 = 公式Q&A整合) +
//     continuousModifier{untargetableByAction} (W2 新 token) → target-expander.candidates() 負 filter で
//     自 uid を対象候補から除外 (actor 非依存、rules/07)。
// a2: ability:declared observer (W2 新 hook、宣言成立時 emit)。matcher = and[triggerPlayerIs self (自分の),
//     triggerCharMatches{side:'self', filter:{trait:'探偵'}} (現場の[探偵]キャラが)]。自身も[探偵]ゆえ
//     自分の宣言でも発火するが本カードは宣言能力を持たない。効果 =「カードを1枚引き、手札を1枚リムーブする」
//     = sequence[draw 1, discard n:1] (両方必須「〜する」rules/15。discard = 手札→リムーブ)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // このキャラがスリープ状態の場合 (スタンは sleep でない → 不成立)
  condition: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' },
  continuousModifier: { untargetableByAction: true },
  description: 'このキャラがスリープ状態の場合、相手の現場にいるキャラはこのキャラを指定してアクションできない。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/07-action-flow.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 自分の現場にいる〚特徴[探偵]〛のキャラが【宣言】能力を使用したとき
  trigger: {
    hook: 'ability:declared',
    matcherCondition: {
      kind: 'and',
      cs: [
        { kind: 'triggerPlayerIs', side: 'self' },
        { kind: 'triggerCharMatches', side: 'self', filter: { trait: '探偵' } },
      ],
    },
  },
  // カードを1枚引き、手札を1枚リムーブする (両方必須)
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【ターン1】自分の現場にいる〚特徴[探偵]〛のキャラが【宣言】能力を使用したとき、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B03057: CardDef = {
  id: 'B03057',
  no: '0312/B03057',
  kind: 'character',
  names: ['槍田郁美'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['探偵'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133406755060.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
