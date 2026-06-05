// cards/ct-d04/D04004 赤井秀一 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   〚ブレット〛（このキャラのアクションはガードできない）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: continuous 無条件 〚ブレット〛付与 — D08021 a2 grantKeywords 同型
// a2: 【ヒラメキ】evidence:remove-by-action で1ドロー — D08013 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 〚ブレット〛（このキャラのアクションはガードできない）
  continuousModifier: { grantKeywords: () => ['ブレット'] },
  description: '〚ブレット〛（このキャラのアクションはガードできない）',
  ruleRefs: ['rules/13-keywords.md'],
};

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

export const D04004: CardDef = {
  id: 'D04004',
  no: '0135/D04004',
  kind: 'character',
  names: ['赤井秀一'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['FBI', '赤井家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013132385566.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
