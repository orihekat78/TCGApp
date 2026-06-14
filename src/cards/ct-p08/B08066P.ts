// cards/ct-p08/B08066P 上原由衣 (キャラ・パラレル) — engine拡張 wave#2 cluster4 (remove-area → deck-bottom, 2026-06-14)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// B08066 と同一効果。P 版は no / rarity / imageUrl のみ異なる (TSV 全文比較で effect/qAndA 完全一致)。
// 句マッピング・既知 engine ギャップ (諸伏高明/大和敢助 の leave:remove-area 反応は DEFER) は B08066.ts を参照。
//   a1: 【宣言】【スリープ】cost pay[sleepSelf, removeAreaToDeckBottom(trait:長野県警, self)] →
//       特徴[長野県警]のキャラ1枚まで (either) に〚突撃〛(turn) を grant。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'removeAreaToDeckBottom',
        target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { trait: '長野県警', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'owner' },
        n: 1,
      },
    ],
  },
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', max: 1, side: 'either', filter: { trait: '長野県警', kind: 'character' }, kw: '突撃', scope: 'turn' } },
  description:
    '【宣言】【スリープ】〚リムーブエリアにある特徴［長野県警］のキャラを1枚デッキの下に移す〛：〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B08066P: CardDef = {
  id: 'B08066P',
  no: '0903/B08066P',
  kind: 'character',
  names: ['上原由衣'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1770878984792442.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
