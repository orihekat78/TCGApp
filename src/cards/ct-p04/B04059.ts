// cards/ct-p04/B04059 水無怜奈 (キャラ) — engine-extension #1 leave:to-remove batch #2 (a2 only)
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   現場にいるこのキャラは〚カード名［本堂瑛海］〛としても扱う。
//   【相手ターン中】【現場リムーブ時】レベル5以下のキャラを1枚まで選び、スリープさせる。
//
// a1 (現場時の名前追加 — 「本堂瑛海」としても扱う) は DEFERRED (動的 names 拡張 未対応)
// a2: leave:to-remove + turn=opp gate で level≤5 を sleep

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', max: 1, side: 'either', state: 'sleep', filter: { levelMax: 5 } },
  },
  description: '【相手ターン中】【現場リムーブ時】レベル5以下のキャラを1枚までスリープ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04059: CardDef = {
  id: 'B04059',
  no: '0450/B04059',
  kind: 'character',
  names: ['水無怜奈'],
  colors: ['赤'],
  level: 4, ap: 4000, lp: 1,
  traits: ['アナウンサー'], keywords: [],
  rarity: 'C',
  imageUrl: '1735287801255986.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
