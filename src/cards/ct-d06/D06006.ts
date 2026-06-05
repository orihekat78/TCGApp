// cards/ct-d06/D06006 遠山和葉 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】自分の現場に【白】のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//
// a1: enter hook (selfOnly) + conditional sceneHas(色白) → charGrantKeyword(突撃, self, turn)。D11015 a2 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場に【白】のキャラがいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '白' } }, nMin: 1 },
    // ターン終了時までこのキャラは〚突撃〛を持つ
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  },
  description:
    '【登場時】自分の現場に【白】のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D06006: CardDef = {
  id: 'D06006',
  no: '0168/D06006',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1718844176807280.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
