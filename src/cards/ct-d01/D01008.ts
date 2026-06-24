// cards/ct-d01/D01008 阿笠博士 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md
// 公式テキスト:
//   【登場時】手札からレベル4以下の〚特徴［少年探偵団］〛のキャラを1枚までスリープ状態で登場させてもよい。登場させなかった場合、キャラを1枚まで選び、ターン終了時までAP＋1000する。
// 句マッピング:
//   - 【登場時】 => ability a1: type 'triggered', scope 'on-scene', trigger {hook 'enter', selfOnly:true} [VERBATIM in src/cards/ct-p03/B03068.ts a1 / src/cards/pr-01/PR094.ts a1 (赤井秀一, same 【登場時】 self-enter card). enter hook listed in capability-map Hooks. BUG-146 (scene.ts:206-210): enter emit source = entering char so selfOnly matches self-card's own 【登場時】 (listeners/triggered.ts selfOnlyMatches).]
//   - 手札からレベル4以下の〚特徴［少年探偵団］〛のキャラを1枚までスリープ状態で登場させてもよい => steps[0]: atom sceneEnter {player:'self', cardId:'$pick.cardId', from:'hand', viaEffect:true, enterSleep:true, bind:'$matched', target:{pick, area:'hand', side:'self', filter:{trait:'少年探偵団', levelMax:4, kind 'character'}, n:{min:0,max:1}, chooser:'self'}} [hand-enter+bind shape VERBATIM in B03068.ts a1 (differs only in filter: B03068 uses color:'赤', mine uses trait:'少年探偵団'). enterSleep:true=スリープ状態で登場 (scene.ts active=false→'sleep'). filter trait/levelMax/kind honored by matchOneFilter (candidates.ts; same filter-eval site as scene picks; trait+kind exemplar src/cards/ct-p05/B05050.ts handAddFromRemove filter:{kind 'character',trait:'探偵'}, trait PA exemplar src/cards/ct-p07/B07010.ts a2 filter:{trait:'少年探偵団'}). kind 'character' per BUG-123 (テキスト「キャラ」). 「1枚まで…してもよい」 = n.min:0 (0-pick legal = decline; buildShortFormPick / pick mechanism rules/15) — the 0-pick carries the optionality (same model as B03068 note). hand-source splice + 現場5枚 switchEnter auto handled by sceneEnter atom (atom-handlers.ts sceneEnter).]
//   - 登場させなかった場合 => steps[1]: conditional if:not(bound{key:'$matched', presence:'matched'}) [VERBATIM in B03068.ts a1 step[1] / PR094.ts a1 step[1] (negative branch of identical optional-enter card). bind '$matched' is written back ONLY inside the cardId-resolved block (scene.ts:197-201 enteredBindKey writeback occurs only when an actual char enters); a 0-pick decline never resolves cardId → bind stays undefined. cond/eval.ts:184-190 bound presence:'matched' returns Array.isArray(bound)&&length>0; not combinator eval.ts:29-30 inverts → true iff no enter occurred = 登場しなかった と厳密一致. conditional then-only (else omitted) supported (resolver.ts conditional if/then/else?).]
//   - キャラを1枚まで選び、ターン終了時までAP＋1000する => steps[1].then: atom charModifyAP {delta:1000, max:1, side:'either', scope 'turn'} [charModifyAP PA short-form (uid absent + isShortFormDelta(delta) + hasNorMax) → paShortFormAwait side='either' chooser=ctx.source.player (src/engine/effect/atom-handlers/char.ts:14-17, _shared.ts:279-296). buildShortFormPick (atom-pick-spec.ts:77-96): max:1 with no n → nMin=0,nMax=1 = 「1枚まで」0-pick legal; side:'either' explicit = どちらの現場のキャラも (rules/15 「キャラ」エリア指定なし). scope 'turn' = ターン終了時まで. Arg shape VERBATIM in src/cards/ct-p07/B07010.ts a2 charModifyAP {delta:3000, max:1, side:'either', filter:{trait:'少年探偵団'}, scope 'turn'} (mine omits filter since 「キャラ」= any char). 「〜する」=mandatory bare atom inside then (no optional wrapper).]
//   - cutIn / hirameki / henso (none printed) => (absent) [rec D01008.json cutIn/hirameki/henso all empty strings → no extra abilities. Single 【登場時】 ability only.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'hand',
          viaEffect: true,
          enterSleep: true,
          bind: '$matched',
          target: {
            kind: 'pick',
            query: {
              area: 'hand',
              side: 'self',
              filter: {
                trait: '少年探偵団',
                levelMax: 4,
                kind: 'character'
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
      {
        kind: 'conditional',
        if: {
          kind: 'not',
          c: {
            kind: 'bound',
            key: '$matched',
            presence: 'matched'
          }
        },
        then: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            delta: 1000,
            max: 1,
            side: 'either',
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '【登場時】手札からレベル4以下の〚特徴［少年探偵団］〛のキャラを1枚までスリープ状態で登場させてもよい。登場させなかった場合、キャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

export const D01008: CardDef = {
  id: 'D01008',
  no: '0097/D01008',
  kind: 'character',
  names: [
    '阿笠博士'
  ],
  colors: [
    '青'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '発明家'
  ],
  rarity: 'D',
  imageUrl: '1714013100412929.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ],
};
