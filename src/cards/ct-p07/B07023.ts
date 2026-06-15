// cards/ct-p07/B07023 光本兵我 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md, rules/19-special-rules.md
// 公式テキスト:
//   自分のターン終了時、このキャラを現場からリムーブしてもよい。そうした場合、〚カード名［服部平次］〛か〚［毛利小五郎］〛のキャラを1枚まで選び、アクティブにする。
// 句マッピング:
//   - 自分のターン終了時 => trigger {hook 'phase:end:start'} + condition:{kind 'turn',player:'self'} [EXACT twin src/cards/ct-p07/B07072.ts a1 (same official sentence). phase:end:start source is undefined so cannot use selfOnly — must gate via condition turn:self (capability-map hooks §phase:end:start line 313-314,354). Also grounded in src/cards/ct-p07/B07021.ts a1 (phase:end:start + condition turn:self). turn condition honored in src/engine/cond/eval.ts (cap-map conditions §turn).]
//   - このキャラを現場からリムーブしてもよい。そうした場合、… => {kind 'optional', effect:{kind 'chain', steps:[ sceneRemove{uid:'$self',cause:'effect'}, … ]}} [EXACT structural twin src/cards/ct-p07/B07072.ts a1 (identical text 'このキャラを現場からリムーブしてもよい。そうした場合'). optional wrapper = 「してもよい」, chain = 「そうした場合」 (前段 no-apply で後段 break) per brief DSL conventions. sceneRemove{uid:'$self',cause:'effect'} self-remove grounded in B07072/B07021.ts a1, capability-map line 606 (自己リムーブ effect先頭 sceneRemove{uid:'$self'} で後続effect継続). sceneRemove explicit-uid path honors uid:'$self' (cap-map atom sceneRemove line 35).]
//   - 〚カード名［服部平次］〛か〚［毛利小五郎］〛のキャラを1枚まで選び、アクティブにする => atom sceneSetState {player:'self', max:1, side:'either', state:'active', filterAny:[{cardName:'服部平次'},{cardName:'毛利小五郎'}]} [EXACT structural twin src/cards/ct-p07/B07072.ts a1 step2 (same '…か…のキャラを1枚まで選び、アクティブにする' — only the OR predicate differs: B07072 uses {color:'赤'}/{color:'黄'}, this card uses {cardName:'服部平次'}/{cardName:'毛利小五郎'}). cardName filter honored on scene-char pick: src/engine/target/candidates.ts matchOneFilter line 260-265 (filter.cardName → allCardNameComponentsForDef, rules/19 split-name) — SAME code path as color (line 273-275). filterAny = .some OR: candidates.ts matchesFilters line 239-241. sceneSetState short-form (uid absent + player + state + n/max → buildShortFormPick('scene'), filterAny passthrough when Array) dispatched in src/engine/effect/atom-handlers.ts case 'sceneSetState'; cap-map atom sceneSetState line 38 + Pattern A. '1枚まで'→max:1 = nMin0 (0-pick legal, rules/15). 'キャラ' area-unspecified = どちらの現場 (rules/15) → side:'either'.]

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
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$self',
            cause: 'effect'
          }
        },
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            state: 'active',
            filterAny: [
              {
                cardName: '服部平次'
              },
              {
                cardName: '毛利小五郎'
              }
            ]
          }
        }
      ]
    }
  },
  description: '自分のターン終了時、このキャラを現場からリムーブしてもよい。そうした場合、〚カード名［服部平次］〛か〚［毛利小五郎］〛のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

export const B07023: CardDef = {
  id: 'B07023',
  no: '0755/B07023',
  kind: 'character',
  names: [
    '光本兵我'
  ],
  colors: [
    '緑'
  ],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [
    'アイドル'
  ],
  rarity: 'C',
  imageUrl: '1762413976180057.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ],
};
