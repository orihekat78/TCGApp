// cards/ct-p09/B09013 妃英理 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/11-reasoning.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【絆毛利小五郎】【登場時】LP1以上のキャラを1枚まで選び、スリープさせる。\n【ターン1】自分の現場にいる、〚カード名［毛利小五郎］〛かAP8000以上のキャラがアクションしたとき、このキャラをスリープさせてもよい。そうした場合、レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【絆毛利小五郎】 => condition:{kind:'bond',cardName:'毛利小五郎'} [bond condition (cond/eval.ts: bond checks owner SCENE for name-component match, scene-only). Exact exemplar: src/cards/ct-p09/B09006.ts a1 uses {kind:'bond',cardName:'妃英理'} (the literal companion card).]
//   - 【登場時】 => trigger:{hook:'enter',selfOnly:true} scope:'on-scene' [enter hook is card-triggerable (listeners/triggered.ts TRIGGERED_HOOKS; payload {uid,viaEffect,enterOrder,enterOrderThisTurn}; selfOnly matches source.uid). Exact exemplar: src/cards/ct-d09/D09014.ts a1 (【登場時】 enter selfOnly).]
//   - LP1以上のキャラを1枚まで選び、スリープさせる。 => atom sceneSetState{player:'self',max:1,side:'either',state:'sleep',filter:{lpMin:1}} [sceneSetState short-form (atom-handlers.ts:709-718: uid absent + player + string state + max => buildShortFormPick scene pick side='either'). buildShortFormPick (atom-pick-spec.ts) passes filter into query. lpMin honored by matchOneFilter (target/candidates.ts:291). max:1 => nMin 0,nMax 1 = '1枚まで' (0-pick legal). Exemplar shape: src/cards/ct-d09/D09014.ts a1 (sceneSetState{player:'self',max:1,side:'either',state:'sleep'}).]
//   - 【ターン1】 => limit:{kind:'turn',n:1} on triggered ability [triggered limit:{kind:'turn',n} enforced per uid+abilityId via declaredUseCount (capability-map hooks §How a triggered ability fires). Exact exemplar: src/cards/ct-p04/B04082.ts a1 (limit turn:1 on action:declare trigger) and src/cards/ct-p04/B04039.ts a1.]
//   - 自分の現場にいる、〚カード名［毛利小五郎］〛かAP8000以上のキャラがアクションしたとき => trigger:{hook:'action:declare', matcherCondition:{kind:'or',cs:[triggerCharMatches{side:'self',filter:{cardName:'毛利小五郎'}}, triggerCharMatches{side:'self',filter:{apMin:8000}}]}} (NOT selfOnly; bearer reacts to another self-side char's action) [action:declare emits payload {byUid,target,uid:byUid,player:byPlayer} (state-machine.ts). triggerCharMatches (cond/eval.ts:244-258) gates side:'self' (payload.player===owner) then runs full matchOneFilter against the scene char; cardName + apMin both honored (candidates.ts:289 apMin, name-component path). matcherCondition is passed straight to evalCond (triggered.ts:177-189), so an OR tree of two triggerCharMatches over the same payload expresses 'is 毛利小五郎 OR AP>=8000'. Exact exemplar: src/cards/ct-p04/B04082.ts a1 + B04039.ts a1 (action:declare + triggerCharMatches side:'self' filter cardName); single-field filter is AND-only so the OR is built as a top-level 'or' Condition combinator (cond/eval.ts 'or' = .some).]
//   - このキャラをスリープさせてもよい。そうした場合、… => conditional(self active){optional{chain[sceneSetState self sleep,<remove>]}}。trigger/turn1 は必ず記録し、解決時に active なら optional を開く。
//   - レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。 => atom sceneRemove{player:'self',max:1,side:'either',state:['sleep'],filter:{levelMax:7}} [sceneRemove short-form PA pick (atom-pick-spec.ts sceneRemove defaultArea scene, mode PA; buildShortFormPick passes state[] + filter). levelMax honored by matchOneFilter (candidates.ts:294). side:'either' since '相手/自分' unqualified 'キャラ' = both scenes (rules/15). max:1 = '1枚まで' (0-pick legal, rules/10). Exact exemplar: src/cards/ct-p09/B09006.ts a1 (sceneRemove{player:'self',max:1,side:'either',filter:{apMax:8000},state:['sleep']}) — identical shape, only apMax->levelMax.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'bond',
    cardName: '毛利小五郎'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      state: 'sleep',
      filter: {
        lpMin: 1
      }
    }
  },
  description: '【絆毛利小五郎】【登場時】LP1以上のキャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'or',
      cs: [
        {
          kind: 'triggerCharMatches',
          side: 'self',
          filter: {
            cardName: '毛利小五郎'
          }
        },
        {
          kind: 'triggerCharMatches',
          side: 'self',
          filter: {
            apMin: 8000
          }
        }
      ]
    }
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'sleep'
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            state: [
              'sleep'
            ],
            filter: {
              levelMax: 7
            }
          }
        }
        ]
      }
    }
  },
  description: '【ターン1】自分の現場にいる、〚カード名［毛利小五郎］〛かAP8000以上のキャラがアクションしたとき、このキャラをスリープさせてもよい。そうした場合、レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B09013: CardDef = {
  id: 'B09013',
  no: '0958/B09013',
  kind: 'character',
  names: [
    '妃英理'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '弁護士'
  ],
  rarity: 'C',
  imageUrl: '1775608818969725.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ],
};
