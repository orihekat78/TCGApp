// cards/ct-p04/B04059 水無怜奈 (character) — scene-only additional name + leave:to-remove
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 24-qa-naming-stun.md
//
// Official text:
//   現場にいるこのキャラは〚カード名［本堂瑛海］〛としても扱う。
//   【相手ターン中】【現場リムーブ時】レベル5以下のキャラを1枚まで選び、スリープさせる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    grantNames: ['本堂瑛海'],
  },
  description: '現場にいるこのキャラは〚カード名［本堂瑛海］〛としても扱う。',
  ruleRefs: ['rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};

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
  description: '【相手ターン中】【現場リムーブ時】レベル5以下のキャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04059: CardDef = {
  id: 'B04059',
  no: '0450/B04059',
  kind: 'character',
  names: ['水無怜奈'],
  colors: ['青'],
  level: 4, ap: 4000, lp: 1,
  traits: ['アナウンサー'], keywords: [],
  rarity: 'C',
  imageUrl: '1735287801255986.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
