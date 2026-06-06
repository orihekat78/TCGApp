// cards/ct-p02/B02004 毛利蘭 (キャラ) — engine-extension multi-hook 共有【ターン1】(2026-06-06 タスクC)
// rules: 11-reasoning.md, 07-action-flow.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【絆工藤新一】【ターン1】このキャラが推理かアクションしたとき、自分のリムーブエリアにあるレベル5以下の
//     〚カード名［妃英理］〛かレベル5以下の〚特徴［毛利探偵事務所］〛のキャラを1枚まで選び、登場させる。
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある〚カード名［工藤新一］〛を1枚まで選び、手札に加える。
//
// a1: 【絆工藤新一】(bond condition) + 【ターン1】+ multi-hook (reasoning:end + action:declare, selfOnly)。
//   効果は enter-from-remove: リムーブの[妃英理]Lv5以下 / [毛利探偵事務所]Lv5以下のキャラを1枚まで登場 (D08024 同型)。
// a2: 【相手ターン中】(turn:opp condition) + 【現場リムーブ時】(leave:to-remove selfOnly) →
//   リムーブの[工藤新一]を1枚まで手札 (handAddFromRemove)。B04030 + handAddFromRemove 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: { kind: 'bond', cardName: '工藤新一' }, // 【絆工藤新一】
  // このキャラが推理 or アクションしたとき (selfOnly、共有【ターン1】)
  trigger: { hook: 'reasoning:end', hooks: ['action:declare'], selfOnly: true },
  effect: {
    // リムーブから [妃英理]Lv5以下 か [毛利探偵事務所]Lv5以下 のキャラを1枚まで登場
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self', from: 'remove', max: 1, viaEffect: true,
      filterAny: [
        { cardName: '妃英理', levelMax: 5, kind: 'character' },
        { trait: '毛利探偵事務所', levelMax: 5, kind: 'character' },
      ],
    },
  },
  description: '【絆工藤新一】【ターン1】推理かアクションしたとき、リムーブの[妃英理]/[毛利探偵事務所]Lv5以下を1枚まで登場。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  trigger: { hook: 'leave:to-remove', selfOnly: true }, // 【現場リムーブ時】
  // リムーブの[工藤新一]を1枚まで手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '工藤新一', kind: 'character' } } },
  description: '【相手ターン中】【現場リムーブ時】リムーブの[工藤新一]を1枚まで手札に加える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B02004: CardDef = {
  id: 'B02004',
  no: '0176/B02004',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357158822894.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
