// cards/ct-d03/D03007 白馬探 (キャラ) — engine-extension multi-hook 共有【ターン1】(2026-06-06 タスクC)
// rules: 11-reasoning.md, 07-action-flow.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【ターン1】このキャラが推理かアクションしたとき、カードを1枚引く。
//
// a1: 「推理か**アクション**したとき」= reasoning:after-sleep + action:declare の multi-hook (selfOnly)。
//   limit turn:1 は ability.id 単位の declaredUseCount で数えるため、2 hook を跨いだ **共有【ターン1】**が
//   自動成立 (推理 or アクションのどちらか 1 回で 1 ドロー、同ターンに両方では発動しない)。
//   ※「アクションしたとき」= rules/22 §アクション宣言時に発動 → action:declare hook を使う。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】(reasoning:after-sleep / action:declare で共有)
  // このキャラが推理 or アクションしたとき (selfOnly: source.uid 一致。reasoning:after-sleep / action:declare 両方で成立)
  trigger: { hook: 'reasoning:after-sleep', hooks: ['action:declare'], selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ターン1】このキャラが推理かアクションしたとき、カードを1枚引く。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D03007: CardDef = {
  id: 'D03007',
  no: '0124/D03007',
  kind: 'character',
  names: ['白馬探'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013117412340.jpg',
  abilities: [a1],
  ruleRefs: ['rules/11-reasoning.md', 'rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
