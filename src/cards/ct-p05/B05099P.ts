// cards/ct-p05/B05099P 高木渉 (character, parallel) — leave-from-remove wave (engine変更0)
// B05099 と effect 完全同一 (parallel: rarity/imageUrl/no のみ差異)。句マッピングは B05099.ts 参照。
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【パートナー黄】【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル4以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'turn', player: 'opp' }] },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: { trait: '警察', levelMax: 4, kind: 'character' },
    },
  },
  description: '【パートナー黄】【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル4以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B05099P: CardDef = {
  id: 'B05099P',
  no: '0597/B05099P',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1747231546554684.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
