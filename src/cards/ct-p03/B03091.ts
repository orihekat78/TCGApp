// cards/ct-p03/B03091 高木長介 (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時までAP＋1000する。
//
// a1: leave:to-remove 自発火 + turn=opp gate で side:self + trait:警察 AP+1000 turn-scope

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: { delta: 1000, max: 1, side: 'self', filter: { trait: '警察' }, scope: 'turn' },
  },
  description: '【相手ターン中】【現場リムーブ時】自分の現場にいる[警察]を1枚までAP+1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B03091: CardDef = {
  id: 'B03091',
  no: '0344/B03091',
  kind: 'character',
  names: ['高木長介'],
  colors: ['黄'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133443680409.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
