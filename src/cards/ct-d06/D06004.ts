// cards/ct-d06/D06004 服部平次 (character) — D06003 の印字完全同文 printing (id/no/imageUrl のみ差)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【事件緑＆白】〚突撃〛（登場したターンからすぐにアクションできる）
//   【パートナー緑】【ターン1】このキャラがアクションしたとき、自分のリムーブエリアにある「【カットイン】AP＋」を持つカードを1枚まで選び、手札に加える。
// 句マッピング: src/cards/ct-d06/D06003.ts と同一 (grounding: .claude/specs/grounding/D06003.md family)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseColor', color: ['緑', '白'], combine: 'and' },
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '【事件緑＆白】〚突撃〛（登場したターンからすぐにアクションできる）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '緑' },
  trigger: { hook: 'action:declare', selfOnly: true },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { cutinTextIncludes: 'AP＋' } },
  },
  description:
    '【パートナー緑】【ターン1】このキャラがアクションしたとき、自分のリムーブエリアにある「【カットイン】AP＋」を持つカードを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const D06004: CardDef = {
  id: 'D06004',
  no: '0167/D06004',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1718844176801241.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
