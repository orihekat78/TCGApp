// cards/ct-p09/B09065 マーク (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   自分のターン終了時、このキャラをスリープさせてもよい。そうした場合、自分の現場にいるこのキャラ以外の〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする。\n【相手ターン中】【現場リムーブ時】自分の現場にいる〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする。
// 句マッピング:
//   - 自分のターン終了時 (a1 trigger) => trigger:{hook:'phase:end:start'} + condition:{kind:'turn',player:'self'} [hook 'phase:end:start' is card-triggerable (capability-map hooks: source undefined → gate by condition, NOT selfOnly). Exemplar src/cards/ct-p09/B09049.ts a1 + ct-d03/D03011.ts a1 + ct-p08/B08015.ts a1 all use exactly trigger:{hook:'phase:end:start'},condition:{kind:'turn',player:'self'} for 自分のターン終了時.]
//   - このキャラをスリープさせてもよい。そうした場合、… (a1 してもよい/そうした場合 structure) => {kind:'optional',effect:{kind:'chain',steps:[ sceneSetState $self sleep, <pick> ]}} [src/cards/ct-p04/B04049.ts a1 = 'このキャラをスリープさせ、…してもよい。そうした場合、…1枚まで選び、リムーブする' modeled as {kind:'optional',effect:{kind:'chain',steps:[{sceneSetState uid:$self state:sleep}, …pick]}}. capability-map wrappers: optional runs inner only if optionalRun (human opt-in); chain = 'そうした場合' semantics. Brief pattern 「〜してもよい。そうした場合、X」=optional+chain.]
//   - このキャラをスリープさせて (a1 self-sleep step) => atom sceneSetState {uid:'$self',state:'sleep'} [src/cards/ct-p04/B04049.ts a1 chain step1 = {verb:'sceneSetState',args:{uid:'$self',state:'sleep'}}. capability-map: sceneSetState honors uid:'$self'+state literal.]
//   - 自分の現場にいるこのキャラ以外の〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする (a1 pick) => atom sceneSetState {uid:'$pick',state:'active',target:{kind:'pick',query:{area:'scene',side:'self',excludeSelf:true,filter:{trait:'FBI'}},n:{min:0,max:1},chooser:'self'}} [side:'self'+state:'active'+filter pick form: src/cards/ct-p09/B09006.ts a1 step2 = sceneSetState{uid:'$pick',state:'active',target:{kind:'pick',query:{area:'scene',side:'self',filter:{cardName:'妃英理'}},n:{min:0,max:1},chooser:'self'}} ('自分の現場にいる…を1枚まで選び、アクティブにする'). excludeSelf on side:'self' scene pick: src/cards/ct-p09/B09049.ts a1 step1 query{area:'scene',side:'self',excludeSelf:true}. trait:'FBI' filter: src/cards/ct-p04/B04049.ts (filter:{trait:'FBI'}). capability-map filters: excludeSelf scene-only drops uid===ctx.source.uid; trait OR-match honored by matchOneFilter. n.min:0 ⇒ 1枚まで (0-pick legal).]
//   - 【相手ターン中】【現場リムーブ時】 (a2 trigger) => trigger:{hook:'leave:to-remove',selfOnly:true} + condition:{kind:'turn',player:'opp'} [src/cards/ct-d03/D03004.ts a1 + ct-p09/B09007.ts a2 = '【相手ターン中】【現場リムーブ時】…' modeled exactly as trigger:{hook:'leave:to-remove',selfOnly:true},condition:{kind:'turn',player:'opp'}. capability-map hooks: leave:to-remove selfOnly ✅ (leaving card's own 現場リムーブ時 via handleLeaveToRemoveSelf).]
//   - 自分の現場にいる〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする (a2 pick) => atom sceneSetState {uid:'$pick',state:'active',target:{kind:'pick',query:{area:'scene',side:'self',filter:{trait:'FBI'}},n:{min:0,max:1},chooser:'self'}} [Long-form sceneSetState pick: src/cards/ct-d03/D03004.ts a1 effect = sceneSetState{uid:'$pick',state:<s>,target:{kind:'pick',query:{area:'scene',side:'either',filter:{levelMax:5},state:['sleep']},n:{min:0,max:1},chooser:'self'}}; state:'active'+side:'self'+trait pick = src/cards/ct-p09/B09006.ts a1 step2 / ct-p06/B06060.ts a1 (sceneSetState state:'active', filter:{trait:'YAIBA'}). capability-map: sceneSetState honors uid:'$pick'+state+target pick query.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'turn',
    player: 'self'
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
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'active',
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: 'self',
                excludeSelf: true,
                filter: {
                  trait: 'FBI'
                }
              },
              n: {
                min: 0,
                max: 1
              },
              chooser: 'self'
            }
          }
        }
        ]
      }
    }
  },
  description: '自分のターン終了時、このキャラをスリープさせてもよい。そうした場合、自分の現場にいるこのキャラ以外の〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'active',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            trait: 'FBI'
          }
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】自分の現場にいる〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B09065: CardDef = {
  id: 'B09065',
  no: '1007/B09065',
  kind: 'character',
  names: [
    'マーク'
  ],
  colors: [
    '赤'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'C',
  imageUrl: '1775608890029462.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
