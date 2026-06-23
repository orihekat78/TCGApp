// cards/ct-p02/B02066P メアリー (character, parallel) — leave-from-remove wave (engine変更0)
// B02066 と effect 完全同一 (parallel: rarity/imageUrl/no のみ差異)。句マッピングは B02066.ts 参照。
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【登場時】カードを1枚引き、手札を1枚リムーブする。
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル5以下の〚カード名［メアリー］〛を1枚まで選び、スリープ状態で登場させる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
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
      filter: { cardName: 'メアリー', levelMax: 5, kind: 'character' },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル5以下の〚カード名［メアリー］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

export const B02066P: CardDef = {
  id: 'B02066P',
  no: '0229/B02066P',
  kind: 'character',
  names: ['メアリー'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1721357267329779.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
