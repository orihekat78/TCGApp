// cards/ct-p01/B01029 服部平次 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【ヒラメキ】 — 証拠が action[case] でリムーブされた時に発動、1ドロー (D08013 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  // 証拠エリアにいる間に有効 (rules/10)
  scope: 'on-evidence',
  // 任意発動 (fire/skip)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01029: CardDef = {
  id: 'B01029',
  no: '0023/B01029',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 5,
  ap: 6000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1714013000987480.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
