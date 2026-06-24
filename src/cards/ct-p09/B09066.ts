// cards/ct-p09/B09066 メアリー (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外の〚特徴［赤井家］〛のキャラがいる場合、キャラを1枚まで選び、スリープさせる。\n【パートナー赤】自分のターン終了時、このキャラがスリープ状態の場合、カードを1枚引き、手札を1枚リムーブする。
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook 'enter', selfOnly:true}, scope 'on-scene' [D08011.ts a1 / D08019.ts a1 / B04049.ts a1 all use trigger {hook 'enter',selfOnly:true}; cap-map line 287-288 hook 'enter' = char登場時, selfOnly matches source.uid (entering char). triggered.ts:254-256 binds ctx.source={player,uid}=owning scene char for on-scene scan.]
//   - 自分の現場にこのキャラ以外の〚特徴［赤井家］〛のキャラがいる場合 => a1 conditional.if = sceneHas{query:{area:'scene',side:'self',filter:{trait:'赤井家'},excludeSelf:true},nMin:1} [D08011.ts:20 EXACT shape sceneHas{query:{area:'scene',side:'self',filter:{trait:'少年探偵団'},excludeSelf:true},nMin:1} for 「自分の現場にこのキャラ以外の〚特徴X〛のキャラがいる場合」. eval.ts:91 sceneHas calls candidates(query) honoring full TargetQuery; candidates.ts:211 honors excludeSelf for char (drops uid===ctx.source.uid). trait is a printed-trait filter (NOT the 非アイコン能力 presence gate).]
//   - キャラを1枚まで選び、スリープさせる => a1 conditional.then = atom sceneSetState{player:'self', max:1, side:'either', state:'sleep'} [D08019.ts:23 EXACT then:{kind 'atom',verb 'sceneSetState',args:{player:'self',max:1,side:'either',state:'sleep'}} for the same clause 「キャラを1枚まで選び、スリープさせる」. cap-map sceneSetState short-form: state string + n/max, pick side='either'. rules/15: エリア無指定「キャラ」= どちらの現場も選べる → side:'either'; 「1枚まで」= max:1 (0枚可, rules/15 量指定子). Surfaces player pick → tier 2.]
//   - 【パートナー赤】 => a2 condition.cs[0] = partnerColor{color:'赤'} [B04049.ts a1 condition.cs[0]=partnerColor{color:'赤'} (same 沖矢昴/赤井家 family); D08003.ts a1 partnerColor{color:'青'}. eval.ts partnerColor: owner($self via ctx.source.player) partner CardDef.colors intersects color.]
//   - 自分のターン終了時 => a2 trigger {hook 'phase:end:start'} + condition.cs[1]=turn{player:'self'} [B07021.ts a1 / D08003.ts a2 both = trigger {hook 'phase:end:start'} + condition:{kind 'turn',player:'self'} for 「自分のターン終了時」. eval.ts turn: state.turn.player===resolvePlayer('self'). cap-map line 315/355: phase:end:start source undefined → selfOnly unusable; gate via condition (done, not using selfOnly).]
//   - このキャラがスリープ状態の場合 => a2 condition.cs[2] = charStateIs{ref:{kind 'self'}, state:'sleep'} [eval.ts:231 case 'charStateIs': resolveCharsForRef(state,cond.ref,ctx).some(uid=>charRead.state===cond.state); ref {kind 'self'} resolves to ctx.source.uid = owning scene char (triggered.ts:254-256). effect.ts:54 type {kind 'charStateIs';ref;state}; eval.ts:452 whitelist charStateIs:true (BUG-145). B04049.ts uses charStateIs in not-form ({kind 'not',c:{kind 'charStateIs',ref:{kind 'self'},state:'sleep'}}); positive form is the same primitive.]
//   - カードを1枚引き、手札を1枚リムーブする => a2 effect = sequence{steps:[draw{player:'self',n:1}, discard{player:'self',n:1}]} [D01003.ts a1 EXACT sequence{steps:[{verb 'draw',args:{player:'self',n:1}},{verb 'discard',args:{player:'self',n:1}}]} for 「カードを1枚引き、手札を1枚リムーブする」(both mandatory 「する」). draw handler requires n:number (cap-map line 16). atomDiscard (core.ts:25) short-form buildShortFormPick(defaultArea=hand) surfaces a player pick for which hand card → tier 2; pure JSON, no closure. rules/15: 「する」必須(可能な限り).]

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
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          trait: '赤井家'
        },
        excludeSelf: true
      },
      nMin: 1
    },
    then: {
      kind: 'atom',
      verb: 'sceneSetState',
      args: {
        player: 'self',
        max: 1,
        side: 'either',
        state: 'sleep'
      }
    }
  },
  description: '【登場時】自分の現場にこのキャラ以外の〚特徴［赤井家］〛のキャラがいる場合、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '赤'
      },
      {
        kind: 'turn',
        player: 'self'
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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      },
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【パートナー赤】自分のターン終了時、このキャラがスリープ状態の場合、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md'
  ]
};

export const B09066: CardDef = {
  id: 'B09066',
  no: '1008/B09066',
  kind: 'character',
  names: [
    'メアリー'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '赤井家'
  ],
  rarity: 'C',
  imageUrl: '1775608890041958.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ],
};
