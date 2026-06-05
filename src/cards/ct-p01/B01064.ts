// cards/ct-p01/B01064 赤井秀一 (キャラ) — catalog-reuse batch
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

export const B01064: CardDef = {
  id: 'B01064',
  no: '0054/B01064',
  kind: 'character',
  names: ['赤井秀一'],
  colors: ['赤'],
  level: 5,
  ap: 6000,
  lp: 1,
  traits: ['FBI', '赤井家'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1714013053491598.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
