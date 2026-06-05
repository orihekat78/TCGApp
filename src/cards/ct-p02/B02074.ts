// cards/ct-p02/B02074 白鳥任三郎 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外の〚特徴［警察］〛のキャラがいる場合、
//     ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//
// a1: 【登場時】 enter hook → conditional(自分の現場に[警察]がいる excludeSelf) →
//     このキャラに 突撃 を付与 (turn)。D08011 a1 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場にこのキャラ以外の〚特徴［警察］〛のキャラがいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' }, excludeSelf: true }, nMin: 1 },
    // ターン終了時までこのキャラは〚突撃〛を持つ
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  },
  description:
    '【登場時】自分の現場にこのキャラ以外の〚特徴［警察］〛のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B02074: CardDef = {
  id: 'B02074',
  no: '0235/B02074',
  kind: 'character',
  names: ['白鳥任三郎'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1721357284501120.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
