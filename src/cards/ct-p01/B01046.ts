// cards/ct-p01/B01046 怪盗キッド (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   [ヒラメキ欄] 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【ヒラメキ】証拠が action[事件] でリムーブされたとき発動、1ドロー (D08013 a2 同型 inline)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動 (ヒラメキ)
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01046: CardDef = {
  id: 'B01046',
  no: '0038/B01046',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 5,
  ap: 6000,
  lp: 1,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1714013020313369.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
