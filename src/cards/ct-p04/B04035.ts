// cards/ct-p04/B04035 真田一三 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分の現場にこのキャラ以外の〚特徴［マジシャン］〛のキャラがいる場合、このキャラをAP＋1000する。
//
// a1: continuous — 現場(自)にこのキャラ以外の[マジシャン]がいる場合 self-only AP+1000 (D08005 a1 同型 / sceneHas excludeSelf gate)
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 自分の現場にこのキャラ以外の[マジシャン]のキャラがいる場合
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'マジシャン' }, excludeSelf: true }, nMin: 1 },
  // このキャラをAP＋1000する
  continuousModifier: { apDelta: 1000 },
  description: '自分の現場にこのキャラ以外の[マジシャン]がいる場合、このキャラをAP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04035: CardDef = {
  id: 'B04035',
  no: '0433/B04035',
  kind: 'character',
  names: ['真田一三'],
  colors: ['白'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['マジシャン'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287759486431.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
