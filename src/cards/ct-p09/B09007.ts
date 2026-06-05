// cards/ct-p09/B09007 脇田兼則 (キャラ) — engine-extension #1 leave:to-remove batch #2 (a2 only)
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー黒】【解決編】【登場時】このキャラをリムーブしてもよい。
//     そうした場合、手札からレベル8以下の〚カード名［ラム］〛を1枚まで登場させる。
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。
//
// a1: DEFERRED (enter optional self-remove + 連鎖 hand-from-name sceneEnter)
// a2: leave:to-remove + turn=opp gate で 1 ドロー

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09007: CardDef = {
  id: 'B09007',
  no: '0952/B09007',
  kind: 'character',
  names: ['脇田兼則'],
  colors: ['青'],
  level: 7, ap: 5000, lp: 1,
  traits: ['寿司職人'], keywords: [],
  rarity: 'R',
  imageUrl: '1775608802624184.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
