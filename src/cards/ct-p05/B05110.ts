// cards/ct-p05/B05110 スコッチ (キャラ) — catalog-reuse batch
// rules: 07-action-flow.md, 09-cutin-disguise.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【事件編】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   【カットイン】【解決編】AP＋2000（コンタクト中に手札からリムーブして使う）
//
// a1: 【事件編】〚突撃［キャラ］〛 — continuous grantKeywords (condition caseStatus 事件編) (D11007 a2 同型)
// a2: 【カットイン】【解決編】AP＋2000 — effect:declared on-hand cutin (D08007 同型 / 条件 caseStatus 解決編)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  continuousModifier: {
    // 〚突撃［キャラ］〛
    grantKeywords: () => ['突撃[キャラ]'],
  },
  description: '【事件編】〚突撃［キャラ］〛',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

// a2: 【カットイン】【解決編】AP＋2000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  condition: { kind: 'caseStatus', status: '解決編' }, // 【解決編】
  // AP＋2000
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】【解決編】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B05110: CardDef = {
  id: 'B05110',
  no: '0606/B05110',
  kind: 'character',
  names: ['スコッチ'],
  colors: ['黒'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322246351561.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
