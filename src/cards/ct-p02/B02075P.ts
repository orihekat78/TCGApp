// cards/ct-p02/B02075P 諸伏高明 (character, parallel) — leave-from-remove wave (engine変更0)
// B02075 と effect 完全同一 (parallel: rarity/imageUrl/no のみ差異)。句マッピングは B02075.ts 参照。
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、スリープ状態で登場させる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: { trait: '長野県警', levelMax: 6, kind: 'character' },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B02075P: CardDef = {
  id: 'B02075P',
  no: '0236/B02075P',
  kind: 'character',
  names: ['諸伏高明'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 2,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1721357284513510.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
