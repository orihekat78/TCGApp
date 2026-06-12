// cards/ct-p07/B07072 澁谷夏子 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md, rules/19-special-rules.md
// 公式テキスト:
//   自分のターン終了時、このキャラを現場からリムーブしてもよい。そうした場合、【赤】か【黄】のキャラを1枚まで選び、アクティブにする。
// 句マッピング:
//   - 自分のターン終了時 => trigger {hook:'phase:end:start'} + condition {kind:'turn',player:'self'} [phase:end:start source is undefined → gate by condition turn self, NOT selfOnly (capability-map hooks §phase:end:start, line 314). EXACT shape from src/cards/ct-d03/D03011.ts a1 (trigger:{hook:'phase:end:start'}, condition:{kind:'turn',player:'self'}); also src/cards/ct-p07/B07088.ts a1 same. turn condition honored in src/engine/cond/eval.ts (capability-map conditions §turn).]
//   - このキャラを現場からリムーブしてもよい。そうした場合、… => {kind:'optional',effect:{kind:'chain',steps:[ sceneRemove{uid:'$self',cause:'effect'}, … ]}} [EXACT structural twin: src/cards/ct-p05/B05019.ts a1 = optional → sequence with step1 sceneRemove{uid:'$self',cause:'effect'} ('このキャラ自身をリムーブ') then a short-form PA pick — official text 'このキャラをリムーブしてもよい。そうした場合〜'. Used chain (vs sequence) per brief's 「〜してもよい。そうした場合、X」 → optional{chain} guidance; chain step1 sceneRemove $self also seen in src/cards/ct-p03/B03114.ts. optional wrapper honored in src/engine/effect/resolver.ts run (capability-map wrappers §optional, line 83: runs only if ctx.dyn.optionalRun, human surfaces __pendingEffectOptionalSide, AI skips). sceneRemove{uid:'$self'} self-remove grounded in B05019/B03114/B03120/B07021. chain semantics: capability-map wrappers §chain (line 80).]
//   - 【赤】か【黄】のキャラを1枚まで選び、アクティブにする => atom sceneSetState {player:'self',max:1,side:'either',state:'active',filterAny:[{color:'赤'},{color:'黄'}]} [sceneSetState active short-form: src/cards/ct-d11/D11003.ts a3 = sceneSetState{player:'self',max:1,side:'either',state:'active'} for 'キャラを1枚まで選び、アクティブにする'. filterAny color-OR group passthrough: src/cards/ct-p09/B09015.ts a1 (handAddFromRemove filterAny:[{cardName},{trait,level}]). Engine: src/engine/effect/atom-pick-spec.ts ATOM_PICK_SPEC.sceneSetState={defaultArea:'scene',mode:'PA',needs:'state'} + buildShortFormPick passes filterAny when Array (line `if(Array.isArray(a.filterAny)) query.filterAny=a.filterAny`), max→nMin0/nMax (1枚まで=0-pick legal). Dispatch: src/engine/effect/atom-handlers.ts case 'sceneSetState' lines 690-700 (uid absent + player + state string + n/max → buildShortFormPick('scene',a,ssP,'either') → tryRePickFromAtom). filterAny + color honored on scene-char pick: src/engine/target/candidates.ts matchesFilters lines 218-221 (filterAny = .some OR) + matchOneFilter lines 253-256 (color vs def.colors). 'キャラ' area-unspecified = どちらの現場 (rules/15) → side:'either'.]

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
                color: '赤'
              },
              {
                color: '黄'
              }
            ]
          }
        }
      ]
    }
  },
  description: '自分のターン終了時、このキャラを現場からリムーブしてもよい。そうした場合、【赤】か【黄】のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

export const B07072: CardDef = {
  id: 'B07072',
  no: '0801/B07072',
  kind: 'character',
  names: [
    '澁谷夏子'
  ],
  colors: [
    '赤'
  ],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [
    '教師'
  ],
  rarity: 'C',
  imageUrl: '1762414010676731.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ],
};
