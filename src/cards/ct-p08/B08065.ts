// cards/ct-p08/B08065 大和敢助 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【FILE6】【自分ターン中】自分の現場に〚特徴［長野県警］〛のキャラが3枚以上いる場合、このキャラをAP＋2000する。
//   【事件編】【登場時】手札から〚特徴［長野県警］〛のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//
// a1: 常時有効 — 【FILE6】【自分ターン中】 自分の現場[長野県警]3枚以上で self-only AP+2000 (B04035 a1 / D08005 a1 同型の条件付き AP 修正)。
// a2: 【事件編】【登場時】手札[長野県警]を1枚リムーブしてもよい。そうした場合 2 ドロー (D08003 a1 同型の chain「そうした場合」)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【FILE6】【自分ターン中】自分の現場に[長野県警]が3枚以上いる場合
  condition: {
    kind: 'and',
    cs: [
      { kind: 'fileAtLeast', n: 6 },
      { kind: 'turn', player: 'self' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' } }, nMin: 3 },
    ],
  },
  // このキャラをAP＋2000する
  continuousModifier: { apDelta: 2000 },
  description: '【FILE6】【自分ターン中】自分の現場に[長野県警]が3枚以上いる場合、このキャラをAP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から[長野県警]のキャラを1枚までリムーブ
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '長野県警' } } },
      // そうした場合、カードを2枚引く (step 1 applied 時のみ)
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【事件編】【登場時】手札から[長野県警]のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B08065: CardDef = {
  id: 'B08065',
  no: '0902/B08065',
  kind: 'character',
  names: ['大和敢助'],
  colors: ['黄'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731238716852.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
