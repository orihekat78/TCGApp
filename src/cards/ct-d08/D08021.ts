// cards/ct-d08/D08021 結成 少年探偵団 (キャラ)
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D08021.md
//
// 公式テキスト:
//   【登場時】自分のリムーブエリアにある、それぞれカード名の異なる〚特徴［少年探偵団］〛のキャラを
//     5枚まで選び、このキャラの下に重ねる。
//   このキャラの下に重なっているカードの数につき、以下の能力を持つ。
//   【1枚以上】〚突撃〛
//   【3枚以上】このキャラがアクションしたとき、カードを1枚引く。
//   【5枚以上】このキャラがアクションしたとき、証拠を1つ得る。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charStackCard',
    args: {
      uid: '$self',
      // D08021 driver 2026-05-26: cardIds:'$pick.cardIds' は multi-pick atom contract。
      // CardListModal の multi-select mode (nMax>1) で 0〜5 枚を選択、effectPickResolve
      // 時に dispatcher が cardIds を resolved 配列に substitute する。atom-handler は
      // a.target.query.area から source area (remove) も参照、splice する。
      cardIds: '$pick.cardIds',
      target: {
        kind: 'pick',
        query: {
          area: 'remove',
          side: 'self',
          filter: { trait: '少年探偵団' },
          distinctNames: true,
        },
        n: { min: 0, max: 5 },
        chooser: 'self',
      },
    },
  },
  description:
    '【登場時】リムーブの[少年探偵団] (カード名が異なる) を5枚までこのキャラの下に重ねる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'stackedCountAtLeast',
    ref: { kind: 'self' },
    n: 1,
  },
  continuousModifier: {
    grantKeywords: () => ['突撃'],
  },
  description: '【1枚以上】〚突撃〛',
  ruleRefs: ['rules/16-card-set.md', 'rules/13-keywords.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:declare', selfOnly: true },
  condition: { kind: 'stackedCountAtLeast', ref: { kind: 'self' }, n: 3 },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【3枚以上】このキャラがアクションしたとき、カードを1枚引く。',
  ruleRefs: ['rules/16-card-set.md', 'rules/07-action-flow.md'],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:declare', selfOnly: true },
  condition: { kind: 'stackedCountAtLeast', ref: { kind: 'self' }, n: 5 },
  effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
  description: '【5枚以上】このキャラがアクションしたとき、証拠を1つ得る。',
  ruleRefs: ['rules/16-card-set.md', 'rules/07-action-flow.md'],
};

export const D08021: CardDef = {
  id: 'D08021',
  no: '0264/D08021',
  kind: 'character',
  names: ['結成 少年探偵団'],
  colors: ['青'],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743100612924.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
