// cards/pr-01/PR043 世良真純 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【登場時】自分の現場に〚カード名［沖矢昴］〛かこのキャラ以外の〚特徴［赤井家］〛のキャラがいる場合、
//     ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//
// a1: 【登場時】(enter selfOnly) → 現場に[沖矢昴] or (このキャラ以外の[赤井家]) がいる場合 → 突撃 (ターン終了まで) — D08011 同型 conditional + charGrantKeyword

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場に[沖矢昴]かこのキャラ以外の[赤井家]のキャラがいる場合
    if: {
      kind: 'or',
      cs: [
        { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '沖矢昴' } }, nMin: 1 },
        { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '赤井家' }, excludeSelf: true }, nMin: 1 },
      ],
    },
    // ターン終了時までこのキャラは〚突撃〛を持つ
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  },
  description:
    '【登場時】自分の現場に[沖矢昴]かこのキャラ以外の[赤井家]がいる場合、ターン終了時まで〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR043: CardDef = {
  id: 'PR043',
  no: '0401/PR043',
  kind: 'character',
  names: ['世良真純'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1727333980431114.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
