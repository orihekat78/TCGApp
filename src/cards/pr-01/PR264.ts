// cards/pr-01/PR264 宮野明美 (character) — engine変更0 wave (triage-verify, 2026-06-28)
// rules: rules/07-action-flow.md, rules/11-reasoning.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
//
// 公式テキスト:
//   〚突撃［キャラ］〛（名乗り状態でもアクション［キャラ］できる）
//   【解決編】現場にいるこのキャラをレベル＋2する。
//   【登場時】自分の現場にレベル7のキャラが3枚以上いる場合、ターン終了時までこのキャラは〚突撃［事件］〛を持つ。
//
// 句マッピング (verified twin = D11015 突撃[キャラ]印字 / B08050 a1 lvlDelta+caseStatus / PR187 charGrantKeyword 突撃[事件] / D08003 sceneHas nMin3):
//   - 印字〚突撃［キャラ］〛= keywords:['突撃[キャラ]'] (D11015 同型、flow/main/action.ts が honor)。
//   - a1 【解決編】このキャラをレベル+2 = continuous, condition caseStatus{解決編}, continuousModifier{lvlDelta:2} (B08050 a1 同型)。
//   - a2 【登場時】現場にレベル7のキャラが3枚以上 → ターン終了まで突撃[事件] = trigger{hook:'enter', selfOnly:true} +
//     conditional{if: sceneHas{query{area:'scene', side:'self', filter:{levelMin:7, levelMax:7}}, nMin:3},
//     then: charGrantKeyword{uid:'$self', kw:'突撃[事件]', scope:'turn'}} (PR187 grant / D08003 sceneHas)。
//     ※公式Q&A: 解決編なら 宮野明美 自身(5+2=7) も「レベル7のキャラ」に数える。lvlDelta は caseStatus gate
//       (level 非参照ゆえ _inContinuousDelta 再入 guard 非作動) → sceneHas が effective Lv7 を自己計数する (B08059 と異なり latch 成立)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  continuousModifier: { lvlDelta: 2 },
  description: '【解決編】現場にいるこのキャラをレベル＋2する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 7, levelMax: 7 } }, nMin: 3 },
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } },
  },
  description: '【登場時】自分の現場にレベル7のキャラが3枚以上いる場合、ターン終了時までこのキャラは〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR264: CardDef = {
  id: 'PR264',
  no: '1055/PR264',
  kind: 'character',
  names: ['宮野明美'],
  colors: ['赤'],
  level: 5, ap: 5000, lp: 1,
  traits: [], keywords: ['突撃[キャラ]'],
  rarity: 'PR',
  imageUrl: '1774884005658386.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
