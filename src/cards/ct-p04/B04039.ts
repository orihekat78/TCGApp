// cards/ct-p04/B04039 ワトソン (キャラ) — engine-extension multi-hook 共有【ターン1】(2026-06-06 タスクC)
// rules: 11-reasoning.md, 07-action-flow.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【ターン1】自分の現場にいる〚カード名［白馬探］〛が推理かアクションしたとき、カードを1枚引く。
//
// a1: 非 selfOnly。reasoning:after-sleep + action:declare の multi-hook を matcherCondition triggerCharMatches で gate。
//   「自分側の[白馬探]が推理 or アクションしたとき」。action:declare payload も uid/player を持つよう拡張済のため
//   triggerCharMatches が両 hook で機能する。limit turn:1 は ability.id 単位 → 共有【ターン1】。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'reasoning:after-sleep',
    hooks: ['action:declare'],
    // 自分側の[白馬探]が推理 or アクションしたとき (rules/11, 22, 19 分割名対応)
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '白馬探' } },
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ターン1】自分の現場の[白馬探]が推理かアクションしたとき、カードを1枚引く。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B04039: CardDef = {
  id: 'B04039',
  no: '0436/B04039',
  kind: 'character',
  names: ['ワトソン'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['鷹'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287759509186.jpg',
  abilities: [a1],
  ruleRefs: ['rules/11-reasoning.md', 'rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
