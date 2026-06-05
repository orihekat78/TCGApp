// cards/ct-p06/B06069 鈴木園子 (キャラ) — engine-extension #4 batch (sceneToHand)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【事件編】【宣言】【スリープ】：カードを1枚引く。
//   【解決編】【宣言】【スリープ】：相手の現場にいるレベル7以下のキャラを1枚まで選び、手札に移す。
//
// a1: 【事件編】declared + sleepSelf cost → 1ドロー
// a2: 【解決編】declared + sleepSelf cost → 相手 levelMax:7 を 1pick で sceneToHand (engine#4)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '事件編' },
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【事件編】【宣言】【スリープ】：カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  cost: { kind: 'sleepSelf' },
  // 相手の現場のキャラを 1 枚まで選び、手札に移す (engine#4 sceneToHand PA短縮形)
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 } },
  },
  description: '【解決編】【宣言】【スリープ】：相手レベル7以下を1枚まで選び、手札に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B06069: CardDef = {
  id: 'B06069',
  no: '0690/B06069',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285244513955.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
