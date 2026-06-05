// cards/ct-p01/B01008 江戸川コナン (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a2: 【ヒラメキ】evidence:remove-by-action で1ドロー (D08013 a2 同型 / ヒラメキは a2 規約)

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01008: CardDef = {
  id: 'B01008',
  no: '0004/B01008',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 5,
  ap: 6000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1734349765579866.jpg',
  abilities: [a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
