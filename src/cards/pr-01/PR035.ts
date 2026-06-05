// cards/pr-01/PR035 毛利蘭 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【登場時】カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える。
//
// a1: 【登場時】(enter selfOnly) → 1ドロー
// a2: 【ヒラメキ】(evidence:remove-by-action optional) → リムーブの[江戸川コナン]を1枚まで手札へ — B02009 a2 同型 handAddFromRemove

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 任意発動 (fire/skip)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 自分のリムーブエリアにある[江戸川コナン]を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '江戸川コナン' } } },
  description: '【ヒラメキ】リムーブの[江戸川コナン]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/19-special-rules.md'],
};

export const PR035: CardDef = {
  id: 'PR035',
  no: '0257/PR035',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 7,
  ap: 5000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '19130d8a06b20c.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
