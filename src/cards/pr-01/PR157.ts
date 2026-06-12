// cards/pr-01/PR157 安室透 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/24-qa-naming-stun.md, rules/01-victory-conditions.md
// 公式テキスト:
//   【解決編】【登場時】自分の現場にレベル6以上の〚特徴［探偵］〛か〚［喫茶ポアロ］〛のキャラがいる場合、このキャラをスタンさせてもよい。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【解決編】 => condition:{kind:'caseStatus',status:'解決編'} on the triggered ability [caseStatus condition (capability-map cond 'caseStatus'); EXACT twin src/cards/ct-d08/D08019.ts a1 places condition:{kind:'caseStatus',status:'解決編'} on an enter-triggered ability. rules/17: unmet 解決編 gate = ability treated as absent.]
//   - 【登場時】 => trigger:{hook:'enter',selfOnly:true}, scope:'on-scene' [enter hook card-triggerable (capability-map hooks: enter emitted by atom-handlers sceneEnter, payload {uid,viaEffect,enterOrder,enterOrderThisTurn}, selfOnly=source.uid). EXACT twin D08019.ts a1; also B09057.ts a1, B09013.ts a1.]
//   - 自分の現場にレベル6以上の〚特徴［探偵］〛か〚［喫茶ポアロ］〛のキャラがいる場合 => effect:{kind:'conditional',if:{kind:'sceneHas',query:{area:'scene',side:'self',filter:{levelMin:6},filterAny:[{trait:'探偵'},{trait:'喫茶ポアロ'}]},nMin:1},then:...} [conditional+sceneHas frame EXACT from D08019.ts a1 (【解決編】【登場時】…がいる場合 → conditional{if:sceneHas{area:'scene',side:'self',filter:{trait}},then}). levelMin honored: src/engine/target/candidates.ts:293 (level<filter.levelMin→false); levelMin pick exemplar B08058.ts a (filter:{levelMin:7,levelMax:7}). filterAny (trait 探偵 OR 喫茶ポアロ) honored on scene picks: candidates.ts:218-221 (filter AND any-of-filterAny). trait strings exact: '探偵' (B09046.ts:32 filter:{trait:'探偵'}), '喫茶ポアロ' (B06094.ts:40 / B05090.ts:88 filter:{trait:'喫茶ポアロ'}). self level-5 安室透 cannot self-satisfy (levelMin:6) so no excludeSelf needed.]
//   - このキャラをスタンさせてもよい => then:{kind:'optional',effect:{kind:'chain',steps:[{atom sceneSetState{uid:'$self',state:'stun'}}, ...]}} [optional = 「してもよい」 (resolver.run optional: runs only if ctx.dyn.optionalRun; AI skips — known, not a blocker). EXACT optional+chain+self-state-change twin B09013.ts a2 ({kind:'optional',effect:{kind:'chain',steps:[sceneSetState{uid:'$self',state:'sleep'}, sceneRemove…]}}) and B09057.ts a1. state:'stun' value honored: D03002.ts a1 (sceneSetState …state:'stun'). uid:'$self' explicit-uid sceneSetState: B09057.ts a2 (sceneSetState{uid:'$self',state:'active'}), B09013.ts a2 step1; capability-map sceneSetState explicit-uid path honors uid+state. Direct atom (resolved uid, not $pick) never sets __chainStepNoApply → chain proceeds to remove step (B09013 note).]
//   - （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる） => reminder text — no effect (engine rules-level stun behavior) [rules/03-field-areas.md + rules/24-qa-naming-stun.md: stun→active becomes sleep is engine-internal. EXACT precedent: D03002.ts maps the identical parenthetical as reminder-only (no separate atom).]
//   - そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする => chain step2: atom sceneRemove{player:'self',max:1,side:'either',filter:{levelMax:7}} [chain = 「そうした場合」 semantics (capability-map wrappers: chain runs step N then N+1). EXACT sceneRemove twin B09013.ts a2 step2 (sceneRemove{player:'self',max:1,side:'either',state:['sleep'],filter:{levelMax:7}}) — mine drops state (text omits state qualifier); shape also B09006.ts a1 (sceneRemove{player:'self',max:1,side:'either',filter:{apMax:8000}}). levelMax honored candidates.ts:294. side:'either' = unqualified 'キャラ' both scenes (rules/15). max:1 = '1枚まで' (nMin 0, 0-pick legal, rules/10).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          levelMin: 6
        },
        filterAny: [
          {
            trait: '探偵'
          },
          {
            trait: '喫茶ポアロ'
          }
        ]
      },
      nMin: 1
    },
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
              state: 'stun'
            }
          },
          {
            kind: 'atom',
            verb: 'sceneRemove',
            args: {
              player: 'self',
              max: 1,
              side: 'either',
              filter: {
                levelMax: 7
              }
            }
          }
        ]
      }
    }
  },
  description: '【解決編】【登場時】自分の現場にレベル6以上の〚特徴［探偵］〛か〚［喫茶ポアロ］〛のキャラがいる場合、このキャラをスタンさせてもよい。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const PR157: CardDef = {
  id: 'PR157',
  no: '0626/PR157',
  kind: 'character',
  names: [
    '安室透'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'PR',
  imageUrl: '1753704129528740.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
    'rules/01-victory-conditions.md'
  ],
};
