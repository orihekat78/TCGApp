// cards/ct-p04/B04049 沖矢昴 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md, rules/19-special-rules.md
// 公式テキスト:
//   【パートナー赤】【登場時】このキャラをスリープさせ、手札から〚特徴［FBI］〛のキャラを1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【パートナー赤】 => condition:{kind:'partnerColor',color:'赤'} on the triggered ability [D08003.ts a1 uses condition:{kind:'partnerColor',color:'青'} alongside trigger hook:'enter'; capability-map condition 'partnerColor {color}' (cond/eval.ts) = owner partner CardDef.colors intersects color]
//   - 【登場時】 => trigger:{hook:'enter',selfOnly:true}, scope:'on-scene' [D08003.ts a1 / PR144.ts a1 both use trigger:{hook:'enter',selfOnly:true}; capability-map hook 'enter' is card-triggerable, selfOnly matches source.uid (entering char)]
//   - このキャラをスリープさせ => atom sceneSetState {uid:'$self',state:'sleep'} as step 1 inside the optional chain [PR144.ts a1 step1 = {verb:'sceneSetState',args:{uid:'$self',state:'sleep'}} (brief: 'このキャラはスリープ状態で登場' B01011 pattern); capability-map sceneSetState honors uid:'$self'+state]
//   - 手札から〚特徴［FBI］〛のキャラを1枚リムーブしてもよい => outer {kind:'optional'} wrapper governing the whole action; inner atom discard {player:'self',max:1,filter:{trait:'FBI',kind:'character'}} [D08003.ts a1 discard{player:'self',max:1,filter:{trait:'少年探偵団'}} (手札から[特徴]を1枚リムーブしてもよい); B08055.ts discard filter:{kind:'character'} → trait+kind AND is standard matchOneFilter; PR144.ts a1 wraps the whole 'このキャラをスリープさせ…してもよい' compound in {kind:'optional'}; capability-map: discard Pattern B short-form defaultArea=hand, optional runs only if optionalRun (human opt-in)]
//   - そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする => chain 'そうした場合' no-apply-stop semantics gating step 3 atom sceneRemove {player:'self',max:1,side:'either',cause:'effect',filter:{levelMax:7}} [D08003.ts a1 step2 = sceneRemove{player:'self',max:1,side:'either',filter:{apMax:8000}} ('そうした場合 …1枚までリムーブ'); B03114.ts/B02051.ts use sceneRemove{max:1,side:'either',filter:{levelMax:7}} (レベル7以下を1枚まで選びリムーブ); capability-map chain breaks when a step has no candidate (substituteAtomPick __chainStepNoApply) → if FBI discard found nothing, sceneRemove is skipped (= 'そうした場合')]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '赤'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
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
          verb: 'discard',
          args: {
            player: 'self',
            max: 1,
            filter: {
              trait: 'FBI',
              kind: 'character'
            }
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            cause: 'effect',
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【パートナー赤】【登場時】このキャラをスリープさせ、手札から〚特徴［FBI］〛のキャラを1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ]
};

export const B04049: CardDef = {
  id: 'B04049',
  no: '0441/B04049',
  kind: 'character',
  names: [
    '沖矢昴'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '大学院生'
  ],
  rarity: 'R',
  imageUrl: '1735287781736012.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ],
};
