// cards/ct-d07/D07014 ライ (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/05-turn-phases.md, rules/03-field-areas.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】相手の現場にいるレベル4以下のキャラを1枚まで選び、リムーブする。リムーブした場合、相手はカードを1枚引く。
// 句マッピング:
//   - 【相手ターン中】 => condition {kind:'turn',player:'opp'} [src/cards/ct-d04/D04010.ts a1 condition:{kind:'turn',player:'opp'} for identical 【相手ターン中】【現場リムーブ時】 prefix; eval honored in src/engine/cond/eval.ts (capability-map conditions §turn)]
//   - 【現場リムーブ時】 => type:'triggered', scope:'on-scene', trigger:{hook:'leave:to-remove', selfOnly:true} [src/cards/ct-d04/D04010.ts a1 trigger:{hook:'leave:to-remove',selfOnly:true} (structural twin, same 黒/赤 lvl5 char shape); hook registered+emitted per capability-map hooks §leave:to-remove (any cause, selfOnly via source.uid), emit site src/engine/mutate/scene.ts]
//   - 相手の現場にいるレベル4以下のキャラを1枚まで選び、リムーブする => atom sceneRemove {player:'self', max:1, side:'opp', cause:'effect', filter:{levelMax:4}} [levelMax filter on sceneRemove: src/cards/ct-p07/B07080.ts a1 sceneRemove{player:'self',max:1,side:'either',cause:'effect',filter:{levelMax:7}}. side:'opp' on sceneRemove: src/cards/ct-p03/B03103.ts:35 sceneRemove{player:'self',max:1,side:'opp'}. max:1 = '1枚まで' (0-pick legal, rules/15) per src/cards/ct-d08/D08003.ts a1 / src/cards/ct-p04/B04023.ts a1. TargetFilter.levelMin/Max honored in matchOneFilter (capability-map filters §levelMin/levelMax)]
//   - リムーブした場合、相手はカードを1枚引く => chain step2 atom draw {player:'opp', n:1}, gated by 'そうした場合' chain semantics [chain 'そうした場合' gating: src/cards/ct-d08/D08003.ts a1 chain[discard max:1 (1枚までリムーブしてもよい), sceneRemove] — step2 runs only if step1 applied. Engine: resolver.ts chain case (lines 59-82) breaks via __chainStepNoApply when step1 has no candidates (resolve-picks.ts:434-437/478-481); when candidates exist but human declines (0-pick), useEngineDispatch.ts effectPickResolve pickedUid===null path (lines 403-408, BUG-111) discards pending incl. its continuation → step2 (draw) dropped; when 1 picked, applyPickAndContinuation runs continuation → draw fires. draw{player:'opp',n:1}: src/cards/ct-d06/D06019.ts:21 / src/cards/ct-p01/B01099.ts. opp draw=相手 benefit, text-faithful]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'opp',
          cause: 'effect',
          filter: {
            levelMax: 4
          }
        }
      },
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'opp',
          n: 1
        }
      }
    ]
  },
  description: '【相手ターン中】【現場リムーブ時】相手の現場にいるレベル4以下のキャラを1枚まで選び、リムーブする。リムーブした場合、相手はカードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/05-turn-phases.md'
  ]
};

export const D07014: CardDef = {
  id: 'D07014',
  no: '0394/D07014',
  kind: 'character',
  names: [
    'ライ'
  ],
  colors: [
    '黒'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'D',
  imageUrl: '1729865282043965.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md'
  ],
};
