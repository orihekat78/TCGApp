// cards/ct-p08/B08051P 赤井秀一 (キャラ・パラレル) — engine拡張 wave#2 cluster4 (remove-area → deck-bottom, 2026-06-14)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// B08051 と同一効果。P 版は no / rarity / imageUrl のみ異なる (TSV 全文比較で effect/qAndA 完全一致)。
// 句マッピングは B08051.ts を参照 (同テキスト別ファイル full def 慣行 / B08012P・B08005P 同様)。
//   a1: 【登場時】［宮野明美］がリムーブにある場合 → 〚突撃〛(turn) を自身に grant (条件喪失でも失わない)。
//   a2: 【宣言】【ターン1】cost removeAreaToDeckBottom([諸星大]|[ライ], self) → 〚ブレット〛(turn) を自身に grant。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'removeNameAtLeast', player: 'self', cardName: '宮野明美', n: 1 },
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  description:
    '【登場時】自分のリムーブエリアに〚カード名［宮野明美］〛がある場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'removeAreaToDeckBottom',
    target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardName: ['諸星大', 'ライ'] } }, n: { min: 1, max: 1 }, chooser: 'owner' },
    n: 1,
  },
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: 'ブレット', scope: 'turn' } },
  description:
    '【宣言】【ターン1】〚リムーブエリアにあるカード名［諸星大］か［ライ］を1枚デッキの下に移す〛：ターン終了時までこのキャラは〚ブレット〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08051P: CardDef = {
  id: 'B08051P',
  no: '0889/B08051P',
  kind: 'character',
  names: ['赤井秀一'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['FBI', '赤井家'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1770878984733747.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
