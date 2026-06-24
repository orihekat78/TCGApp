// cards/ct-p03/B03095 松本清長 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【ターン1】相手の現場にいるキャラがアクションしたとき、このキャラがスリープ状態の場合、自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、アクティブにする。
// 句マッピング:
//   - 【ターン1】 => ability.limit:{kind 'turn',n:1} [src/cards/ct-p02/B02026.ts a1 limit:{kind 'turn',n:1} on an action:declare triggered ability (VERBATIM same trigger family). Enforced per uid+abilityId via declaredUseCount at fire time (capability-map §How a triggered ability fires; only kind 'turn' enforced for triggered). Also src/cards/ct-p09/B09013.ts a2.]
//   - 相手の現場にいるキャラがアクションしたとき => trigger {hook 'action:declare'} + condition leg {kind 'triggerCharMatches',side:'opp',filter:{}} (NOT selfOnly = board observer) [VERBATIM from src/cards/ct-p02/B02026.ts a1 and src/cards/ct-p03/B03097.ts a1 (both '相手の現場にいるキャラが…アクションしたとき' = action:declare + triggerCharMatches{side:'opp',filter:{}}). action:declare emits payload {byUid,target,uid:byUid,player:byPlayer} after attacker sleeps, before guard (state-machine.ts; rules/22 宣言時発火). eval.ts:314-348 triggerCharMatches default path reads payload.player; side:'opp' fails when tcmPlayer===ctx.source.player so it requires the attacker be the opponent's char (eval.ts:337-338). The EMPTY filter:{} is required (not omitted): eval.ts:339-342 then runs scene.find on opp.scene, excluding partner-area attacks → faithfully '現場にいるキャラ' (rules/03; documented in B02026 comment). 'アクション' has no [キャラ]/[事件] qualifier → no triggerActionKind gate (matches B02026).]
//   - このキャラがスリープ状態の場合 => condition leg {kind 'charStateIs',ref:{kind 'self'},state:'sleep'} (positive, AND-combined with actor-gate) [charStateIs shape grounded by src/cards/ct-p03/B03124.ts a2 and src/cards/ct-p09/B09013.ts a2 ({kind 'charStateIs',ref:{kind 'self'},state:'sleep'}); eval.ts:231-234 returns charRead.state(self uid)==='sleep'. Here used POSITIVELY (require sleep) — B09013/B03124 wrap it in 'not' because their effect sleeps self; mine requires self already sleeping to activate others. handleHook scan (listeners/triggered.ts:197-264) has NO active-state filter on the reacting card, so a sleeping scene char fires its triggered ability and the condition gate at line 252-264 enforces state==='sleep'. AND combinator from B03124.ts a2 condition:{kind 'and',cs:[...]} (eval.ts and=.every).]
//   - 自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、アクティブにする => effect atom sceneSetState{player:'self',max:1,side:'self',state:'active',filter:{trait:'警察'}} [VERBATIM shape from src/cards/ct-p03/B03004.ts a1 step2 (sceneSetState{player:'self',max:1,side:'self',state:'active',filter:{cardName:'毛利蘭',...}}) and src/cards/ct-p03/B03017.ts a1 (sceneSetState{player:'self',max:1,state:'active',filter:{trait:'少年探偵団'}}). Short-form path atom-handlers/scene.ts:343-345 (uid absent + player + string state + n|max) builds pick; buildShortFormPick (atom-pick-spec.ts:87) honors explicit side:'self' over the 'either' default → restricts to own scene ('自分の現場にいる'). filter passed into query (line 88) → matchOneFilter honors trait:'警察'. max:1 => n:{min:0,max:1} = '1枚まで' (0-pick legal, rules/15). mutate.scene.setState (scene.ts:379-394) converts 'active' on a stunned char to 'sleep' (rules/03 stun special rule, engine-handled). Scene picks are inherently characters so kind 'character' is omitted to match the two shipped exemplars.]

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
    hook: 'action:declare'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'triggerCharMatches',
        side: 'opp',
        filter: {}
      },
      {
        kind: 'charStateIs',
        ref: {
          kind: 'self'
        },
        state: 'sleep'
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'self',
      state: 'active',
      filter: {
        trait: '警察'
      }
    }
  },
  description: '【ターン1】相手の現場にいるキャラがアクションしたとき、このキャラがスリープ状態の場合、自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B03095: CardDef = {
  id: 'B03095',
  no: '0348/B03095',
  kind: 'character',
  names: [
    '松本清長'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1729133463270375.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
