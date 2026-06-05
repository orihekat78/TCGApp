// cards/ct-p06/B06040 遠山和葉 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【絆服部平次】【自分ターン中】AP＋1000
//   【登場時】自分の現場にこのキャラ以外の〚特徴［高校生］〛のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//
// a1: 【絆服部平次】【自分ターン中】= continuous (condition and(bond, turn:self)) apDelta +1000 (B01091 a1 同型)。
// a2: 【登場時】 enter trigger → conditional sceneHas(高校生, excludeSelf) → charGrantKeyword(突撃, self, turn) (D06006 a1 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆服部平次】【自分ターン中】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '服部平次' },
      { kind: 'turn', player: 'self' },
    ],
  },
  // AP＋1000
  continuousModifier: { apDelta: 1000 },
  description: '【絆服部平次】【自分ターン中】AP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場にこのキャラ以外の[高校生]のキャラがいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '高校生' }, excludeSelf: true }, nMin: 1 },
    // ターン終了時までこのキャラは〚突撃〛を持つ
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  },
  description: '【登場時】現場にこのキャラ以外の[高校生]がいる場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B06040: CardDef = {
  id: 'B06040',
  no: '0663/B06040',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285189496476.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
