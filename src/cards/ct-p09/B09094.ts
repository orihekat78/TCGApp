// cards/ct-p09/B09094 ジン (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【事件赤＆黒】〚突撃［キャラ］〛
//   〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、このキャラは〚突撃［事件］〛を持つ。
//   【登場時】〚痕跡［未発見］〛の場合、相手のデッキのカードを上から2枚リムーブする。
//
// a1: 【事件赤＆黒】continuous grantKeywords 突撃[キャラ] (caseColor combine:'and')
// a2: 痕跡発見済 continuous grantKeywords 突撃[事件] (scratchTrace)
// a3: 【登場時】痕跡未発見なら 相手デッキ上 2 mill

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【事件赤＆黒】
  condition: { kind: 'caseColor', color: ['赤', '黒'], combine: 'and' },
  // 〚突撃［キャラ］〛
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'], printedKeywordWhenIconValid: true },
  description: '【事件赤＆黒】〚突撃［キャラ］〛',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 〚痕跡［発見済み］〛(engine 値は '発見済')
  condition: { kind: 'scratchTrace', player: 'self', v: '発見済' },
  // 〚突撃［事件］〛を持つ
  continuousModifier: { grantKeywords: () => ['突撃[事件]'] },
  description: '〚痕跡［発見済み］〛の場合、このキャラは〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 〚痕跡［未発見］〛の場合
    if: { kind: 'scratchTrace', player: 'self', v: '未発見' },
    // 相手のデッキのカードを上から2枚リムーブする
    then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } },
  },
  description: '【登場時】〚痕跡［未発見］〛の場合、相手のデッキのカードを上から2枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09094: CardDef = {
  id: 'B09094',
  no: '1033/B09094',
  kind: 'character',
  names: ['ジン'],
  colors: ['黒'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608926480328.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
