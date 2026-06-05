// cards/pr-01/PR174 毛利小五郎 (キャラ) — catalog-reuse batch
// rules: 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【事件編】【登場時】手札から〚特徴［毛利探偵事務所］〛のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//   【解決編】【自分ターン中】自分の現場に〚特徴［毛利探偵事務所］〛のキャラが3枚以上いる場合、このキャラをAP＋2000する。
//
// a1: 【事件編】【登場時】(enter selfOnly, caseStatus 事件編) → chain[手札の[毛利探偵事務所]を1枚までリムーブ, 2ドロー]
//     D08003 a1 chain 同型: step0 が apply されなければ chain break = 「そうした場合」のゲート。
// a2: 【解決編】【自分ターン中】現場の[毛利探偵事務所]3枚以上で このキャラを AP+2000 (continuous, 自己対象)。
//     D08005 a1 continuous + D08003 a2 sceneHas 同型。AP read 時に condition を再評価。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から〚特徴［毛利探偵事務所］〛のカードを1枚までリムーブ (してもよい)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { trait: '毛利探偵事務所' } } },
      // そうした場合、カードを2枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【事件編】【登場時】手札から[毛利探偵事務所]を1枚リムーブしてもよい。そうした場合2ドロー。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 【解決編】【自分ターン中】自分の現場に〚特徴［毛利探偵事務所］〛のキャラが3枚以上いる場合
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'turn', player: 'self' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '毛利探偵事務所' } }, nMin: 3 },
    ],
  },
  // このキャラをAP＋2000する
  continuousModifier: { apDelta: 2000 },
  description: '【解決編】【自分ターン中】現場の[毛利探偵事務所]3枚以上で このキャラ AP+2000。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR174: CardDef = {
  id: 'PR174',
  no: '0727/PR174',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['探偵', '毛利探偵事務所'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '198e68c65a026.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
