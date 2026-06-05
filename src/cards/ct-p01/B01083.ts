// cards/ct-p01/B01083 安室透 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 17-icons.md
//
// 公式テキスト:
//   [ヒラメキ欄] 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【ヒラメキ】証拠が action[事件] でリムーブされた時に発動、1 ドロー (D08013 a2 と同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  // 証拠エリアにいる間に有効 (rules/10)
  scope: 'on-evidence',
  // 【ヒラメキ】任意発動 (fire/skip)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01083: CardDef = {
  id: 'B01083',
  no: '0071/B01083',
  kind: 'character',
  names: ['安室透'],
  colors: ['黄'],
  level: 5,
  ap: 6000,
  lp: 1,
  traits: ['探偵', '喫茶ポアロ'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1714013067523262.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
  ],
};
