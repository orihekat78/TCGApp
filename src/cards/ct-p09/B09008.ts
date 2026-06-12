// cards/ct-p09/B09008 赤木英雄 (character) — Task A certify-harvest needsManual (engine変更0, 手書き closure)
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   このキャラがAP6000以上の場合、このキャラは〚突撃〛（名乗り状態でもアクションできる）を持つ。
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、自分か相手の現場にいるキャラにセットされているカードを1枚まで選び、リムーブする。
//
// a1: 常時有効型 (rules/24) — apAtLeast{self,6000} を満たす間 〚突撃〛を持つ。
//   condition が能力全体ゲート (rules/17: 条件未達=その能力を持たない)、continuousModifier.grantKeywords は
//   closure (D04004/D08021 同型) のため手書き。基礎AP5000なので +1000 以上の修正時のみ突撃。
// a2: 【登場時】opt(手札1リムーブ) → セットカード1枚リムーブ。optional{chain[discard1, charRemoveSetCard]}
//   (「してもよい/そうした場合」= optional+chain)。charRemoveSetCard side:'either' (自分/相手) (B08034 同型, side拡張)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'apAtLeast', ref: { kind: 'self' }, n: 6000 }, // AP6000以上の場合
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: 'このキャラがAP6000以上の場合、このキャラは〚突撃〛（名乗り状態でもアクションできる）を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // 手札を1枚リムーブしてもよい。そうした場合、セットカードを1枚まで選びリムーブ (自分/相手)
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', max: 1, side: 'either', filter: { hasSetCards: true } } },
      ],
    },
  },
  description: '【登場時】手札を1枚リムーブしてもよい。そうした場合、自分か相手の現場にいるキャラにセットされているカードを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B09008: CardDef = {
  id: 'B09008',
  no: '0953/B09008',
  kind: 'character',
  names: ['赤木英雄'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 0,
  traits: ['サッカー選手'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608802640706.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};
