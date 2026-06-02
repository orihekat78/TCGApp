// cards/ct-d08/D08011 円谷光彦 (キャラ)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D08011.md
//
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外の〚特徴［少年探偵団］〛のキャラがいる場合、
//     ターン終了時までこのキャラは〚突撃〛を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場にこのキャラ以外の[少年探偵団]がいる場合、
    if: {kind: 'sceneHas',query: {area: 'scene',side: 'self',filter: { trait: '少年探偵団' },excludeSelf: true,},nMin: 1,},
    // ターン終了時までこのキャラは〚突撃〛を持つ。
    then: {kind: 'atom',verb: 'charGrantKeyword',args: { uid: '$self', kw: '突撃', scope: 'turn' },},
  },
  description:
    '【登場時】自分の現場にこのキャラ以外の[少年探偵団]がいる場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D08011: CardDef = {
  id: 'D08011',
  no: '0493/D08011',
  kind: 'character',
  names: ['円谷光彦'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093474254.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
