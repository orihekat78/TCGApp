// cards/ct-p09/B09080 高木渉 (character) — engine変更0 wave (triage-verify, 2026-06-28)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/24-qa-naming-stun.md
//
// 公式テキスト:
//   【絆佐藤美和子】〚突撃〛（名乗り状態でもアクションできる）
//   【絆佐藤美和子】【相手ターン中】自分の現場にいる〚カード名［佐藤美和子］〛をAP＋1000する。
//
// 句マッピング (verified twin = B05091 a1 bond-grant / B02012 a1 apDeltaAura+auraFilter):
//   - a1 【絆佐藤美和子】〚突撃〛= continuous, condition{kind:'bond', cardName:'佐藤美和子'},
//     continuousModifier{grantKeywords: () => ['突撃']} (B05091 a1 同型、突撃[キャラ]→突撃 差替)。
//     条件外で即失効 (rules/24 常時有効型)。bare 突撃 は名乗り action 例外 (flow/main/action.ts)。
//   - a2 【絆佐藤美和子】【相手ターン中】自分の現場の〚佐藤美和子〛をAP＋1000 = continuous,
//     condition and[{bond:佐藤美和子}, {turn:'opp'}], continuousModifier{apDeltaAura:1000,
//     auraFilter:{cardName:'佐藤美和子', kind:'character'}} (B02012 a1 の aura を cardName 指定に差替)。
//     board-scan reader が自 side 現場の佐藤美和子に +1000 (rules/24 常時有効、相手ターン中のみ)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '佐藤美和子' },
  continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true },
  description: '【絆佐藤美和子】〚突撃〛（名乗り状態でもアクションできる）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '佐藤美和子' }, { kind: 'turn', player: 'opp' }] },
  continuousModifier: { apDeltaAura: 1000, auraFilter: { cardName: '佐藤美和子', kind: 'character' } },
  description: '【絆佐藤美和子】【相手ターン中】自分の現場にいる〚カード名［佐藤美和子］〛をAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};

export const B09080: CardDef = {
  id: 'B09080',
  no: '1020/B09080',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 5, ap: 5000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [],
  rarity: 'C',
  imageUrl: '1775608910331466.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
