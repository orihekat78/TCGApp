// cards/ct-p03/B03022 若狭留美 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分の現場にこのキャラ以外のキャラがいない場合、このキャラをAP＋2000する。
//
// a1: continuous (常時有効型) — 自分の現場の「このキャラ以外」のキャラが0枚 (= not sceneHas excludeSelf nMin:1) の間、
//     このキャラを AP＋2000 (continuousModifier.apDelta は自キャラのみ適用。D08005 a1 同型の self continuous)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 自分の現場にこのキャラ以外のキャラがいない場合
  condition: {
    kind: 'not',
    c: { kind: 'sceneHas', query: { area: 'scene', side: 'self', excludeSelf: true }, nMin: 1 },
  },
  // このキャラをAP＋2000する。
  continuousModifier: { apDelta: 2000 },
  description: '自分の現場にこのキャラ以外のキャラがいない場合、このキャラをAP＋2000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B03022: CardDef = {
  id: 'B03022',
  no: '0280/B03022',
  kind: 'character',
  names: ['若狭留美'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['教師'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133201258481.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md',
  ],
};
