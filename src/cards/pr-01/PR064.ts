// cards/pr-01/PR064 服部平次 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【解決編】【登場時】相手の現場にスリープ状態かスタン状態のキャラが合わせて2枚以上いる場合、レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。（自分の事件が解決編になっている場合、この能力か効果を使える）
// 句マッピング:
//   - 【解決編】 (条件アイコン) / （自分の事件が解決編になっている場合、この能力か効果を使える） => ability.condition = { kind 'caseStatus', status:'解決編' } [src/cards/ct-d08/D08019.ts a1 and src/cards/ct-p05/B05089.ts a2 gate an enter-triggered ability with exactly { kind 'caseStatus', status:'解決編' }. capability-map Conditions §caseStatus (cond/eval.ts: owner case status equals). The parenthetical is a confirmatory note restating 【解決編】 = case in 解決編; fully covered by the condition. brief maps 条件アイコン(【解決編】) -> ability.condition.]
//   - 【登場時】 => trigger = { hook 'enter', selfOnly:true } [src/cards/ct-d08/D08019.ts a1 trigger {hook 'enter',selfOnly:true} and B05089.ts a2 identical. capability-map Hooks §enter: 【登場時】, selfOnly ✅ via source.uid; disguise does NOT fire enter (matches text 登場時 not 変装時).]
//   - 相手の現場にスリープ状態かスタン状態のキャラが合わせて2枚以上いる場合 => conditional.if = { kind 'sceneHas', query:{ area:'scene', side:'opp', state:['sleep','stun'] }, nMin:2 } [src/cards/ct-d02/D02013.ts line 17 uses the IDENTICAL Japanese clause with the EXACT DSL { kind 'sceneHas', query:{ area:'scene', side:'opp', state:['sleep','stun'] }, nMin:2 }. capability-map Conditions §sceneHas: candidates(query) count >= nMin, full TargetQuery incl. state (filter ref: state is scene-char OR over array via matchesQueryForChar).]
//   - レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする => conditional.then = { kind 'atom', verb 'sceneRemove', args:{ player:'self', max:1, side:'either', filter:{ levelMax:7 }, state:['sleep'] } } [src/cards/ct-d11/D11020.ts line 28 uses the IDENTICAL Japanese clause with the EXACT DSL { verb 'sceneRemove', args:{ player:'self', max:1, side:'either', filter:{ levelMax:7 }, state:['sleep'] } }. capability-map Atom verbs §sceneRemove: short-form (area=scene) builds PA pick uid='$pick'; max:1 with no min => 0-pick legal (rules/15 「〜枚まで」); side:'either' = either side (no side restriction in text, rules/15); cause defaults to 'effect' (能力によるリムーブ). Pick proven to work inside conditional.then by D08019.ts a1 (short-form sceneSetState in conditional.then).]

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
        side: 'opp',
        state: [
          'sleep',
          'stun'
        ]
      },
      nMin: 2
    },
    then: {
      kind: 'atom',
      verb: 'sceneRemove',
      args: {
        player: 'self',
        max: 1,
        side: 'either',
        filter: {
          levelMax: 7
        },
        state: [
          'sleep'
        ]
      }
    }
  },
  description: '【解決編】【登場時】相手の現場にスリープ状態かスタン状態のキャラが合わせて2枚以上いる場合、レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

export const PR064: CardDef = {
  id: 'PR064',
  no: '0404/PR064',
  kind: 'character',
  names: [
    '服部平次'
  ],
  colors: [
    '緑'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'PR',
  imageUrl: '1732542002113285.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
