// cards/ct-p01/B01066 世良真純 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/10-action-event.md, rules/22-qa-action-contact.md, rules/03-field-areas.md, rules/17-icons.md
// 公式テキスト:
//   【ターン1】このキャラがアクション［事件］したとき、このキャラをアクティブにする。
// 句マッピング:
//   - 【ターン1】 => ability.limit = { kind 'turn', n:1 } [Exemplar src/cards/ct-p01/B01028.ts a3 and ct-p01/B01036.ts a1 both use limit:{kind 'turn',n:1} for 【ターン1】 on a triggered ability. Brief: 【ターンN】 = ability.limitPerTurn (limit field).]
//   - このキャラが…したとき (this char is the actor) => trigger.selfOnly = true on hook 'action:declare' [Exemplar src/cards/ct-p01/B01068.ts a1: trigger {hook 'action:declare', selfOnly:true, ...} for 「このキャラがアクション［事件］したとき」. Engine: src/engine/flow/action/state-machine.ts:198-201 emits action:declare with source={player:byPlayer, uid:byUid} (byUid=attacker=the acting char). src/engine/listeners/triggered.ts:173-174 selfOnlyMatches for scene cards returns source.uid===card.uid, so selfOnly fires only when THIS card is the actor. selfOnly checked at triggered.ts:211.]
//   - アクション［事件］ => trigger.matcherCondition = { kind 'triggerActionKind', v:'case' } [Exemplar src/cards/ct-p01/B01068.ts a1 (matcherCondition:{kind 'triggerActionKind',v:'case'}) and ct-d04/D04005.ts a1 (same, action[事件]). Engine: src/engine/cond/eval.ts:327-330 triggerActionKind returns ctx.triggerPayload.target.kind === cond.v; 'case'=action[事件]. Registered in CONDITION_KIND_MAP line 385. matcherCondition evaluated via evalCond at triggered.ts:216-228 with triggerPayload=payload. selfOnly AND matcherCondition are both checked (lines 211 + 228).]
//   - このキャラをアクティブにする => effect atom sceneSetState { uid:'$self', state:'active' } [Exemplar src/cards/ct-p01/B01028.ts a3 (verb 'sceneSetState', args:{uid:'$self', state:'active'}) for 「このキャラをアクティブにする」, and ct-p08/B08015.ts a1 (same). Engine: src/engine/effect/atom-handlers.ts:965-979 — with explicit uid present (not undefined), short-form pick branch (968) is SKIPPED, goes to line 972 resolveBindRef(a.uid) then mutate.scene.setState(s, uid, 'active') — NO player pick. resolveBindRef '$self' → ctx.source.uid (atom-handlers.ts:167-168). Stun→sleep special case (rules/03) handled by engine default in src/engine/mutate/scene.ts:274-281.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'action:declare',
    selfOnly: true,
    matcherCondition: {
      kind: 'triggerActionKind',
      v: 'case'
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$self',
      state: 'active'
    }
  },
  description: '【ターン1】このキャラがアクション［事件］したとき、このキャラをアクティブにする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/22-qa-action-contact.md',
    'rules/03-field-areas.md',
    'rules/17-icons.md'
  ]
};

export const B01066: CardDef = {
  id: 'B01066',
  no: '0056/B01066',
  kind: 'character',
  names: [
    '世良真純'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [
    '探偵',
    '高校生',
    '赤井家'
  ],
  rarity: 'R',
  imageUrl: '1714013053502575.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/22-qa-action-contact.md',
    'rules/03-field-areas.md',
    'rules/17-icons.md'
  ],
};
