// cards/ct-p01/B01049 怪盗キッド (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   【自分ターン中】相手の現場にキャラが3枚以上いる場合、このキャラをAP＋2000する。
//
// a1: continuous (常時有効型) — 【自分ターン中】かつ 相手現場3枚以上 の間 自キャラ AP＋2000
//     (condition で gate / continuousModifier.apDelta は自キャラのみ適用。B03022 / D08005 a1 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      // 【自分ターン中】
      { kind: 'turn', player: 'self' },
      // 相手の現場にキャラが3枚以上いる場合
      { kind: 'sceneHas', query: { area: 'scene', side: 'opp' }, nMin: 3 },
    ],
  },
  // このキャラをAP＋2000する
  continuousModifier: { apDelta: 2000 },
  description: '【自分ターン中】相手の現場にキャラが3枚以上いる場合、このキャラをAP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md', 'rules/25-qa-effects-resolution.md'],
};

export const B01049: CardDef = {
  id: 'B01049',
  no: '0041/B01049',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013020327539.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
