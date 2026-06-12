// cards/ct-p08/B08088 バーボン (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md, rules/07-action-flow.md
// 公式テキスト:
//   【事件青＆黒】【解決編】【相手ターン中】【現場リムーブ時】手札を1枚リムーブしてもよい。そうした場合、相手の現場にいるレベル7以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【事件青＆黒】 => condition caseColor{color:['青','黒'],combine:'and'} (要・両色) [caseColor + combine:'and' exact shape from src/cards/ct-d06/D06010.ts a1 ({kind:'caseColor',color:['緑','白'],combine:'and'}); capability-map cond caseColor combine:'and' ⇒ must have ALL (src/engine/cond/eval.ts caseColor)]
//   - 【解決編】 => condition caseStatus{status:'解決編'} [ability-level condition caseStatus exact shape from src/cards/ct-p08/B08044.ts a2 ({kind:'caseStatus',status:'解決編'}); also conditional.if usage in src/cards/ct-p08/B08089.ts a1; capability-map cond caseStatus (eval.ts:74)]
//   - 【相手ターン中】 => condition turn{player:'opp'} [src/cards/ct-p03/B03069.ts a2 + src/cards/ct-p08/B08089.ts a1 both gate leave:to-remove with condition:{kind:'turn',player:'opp'}; capability-map cond turn (opp=opp-of-owner)]
//   - (3条件のAND結合) => condition and{cs:[caseColor, caseStatus, turn]} [3-condition and{cs:[...]} grounded src/cards/ct-p08/B08007.ts a4 ({kind:'and',cs:[turn,stackedCountAtLeast,fileAtLeast]}); and+turn on triggered gate grounded src/cards/ct-p04/B04023.ts a1; capability-map cond and (.every)]
//   - 【現場リムーブ時】 => triggered type, scope:'on-scene', trigger:{hook:'leave:to-remove',selfOnly:true} [exact twin src/cards/ct-p08/B08083.ts a1 + src/cards/ct-p03/B03069.ts a2 (黒ずくめ char, leave:to-remove selfOnly + turn:opp gate); capability-map hook leave:to-remove (any cause, self-leave fires via handleLeaveToRemoveSelf, selfOnly ✅)]
//   - 手札を1枚リムーブしてもよい。そうした場合、 => effect optional{chain:[discard{player:'self',n:1}, <removal>]} — 「してもよい」=optional, 「そうした場合」=chain gated on leading discard [EXACT pattern src/cards/ct-p07/B07073.ts a2 (optional{chain[discard{n:1}, body]} for '手札を1枚リムーブしてもよい。そうした場合'); leading-step-gates-chain grounded src/cards/ct-p04/B04023.ts a1; discard empty-hand → __chainStepNoApply=true → chain break verified src/engine/effect/resolve-picks.ts:436/480 + resolver.ts:79-82; capability-map verb discard + wrapper optional/chain]
//   - 相手の現場にいるレベル7以下のキャラを1枚まで選び、リムーブする => atom sceneRemove{player:'self',max:1,side:'opp',cause:'effect',filter:{levelMax:7}} [side:'opp'+filter:{levelMax:7} for literal '相手の現場にいるレベル7以下のキャラを1枚まで選び' grounded src/cards/ct-p06/B06069.ts a2 (same wording, args {player:'self',max:1,side:'opp',filter:{levelMax:7}}); sceneRemove arg shape (max:1,cause:'effect',filter:{levelMax}) grounded src/cards/ct-p07/B07095.ts a2 + src/cards/ct-p09/B09101.ts; capability-map verb sceneRemove short-form PA pick, levelMax honored (TargetFilter §F, BUG-118)]

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
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: [
          '青',
          '黒'
        ],
        combine: 'and'
      },
      {
        kind: 'caseStatus',
        status: '解決編'
      },
      {
        kind: 'turn',
        player: 'opp'
      }
    ]
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'opp',
            cause: 'effect',
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【事件青＆黒】【解決編】【相手ターン中】【現場リムーブ時】手札を1枚リムーブしてもよい。そうした場合、相手の現場にいるレベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md'
  ]
};

export const B08088: CardDef = {
  id: 'B08088',
  no: '0924/B08088',
  kind: 'character',
  names: [
    'バーボン'
  ],
  colors: [
    '黒'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'C',
  imageUrl: '1770731255866468.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/07-action-flow.md'
  ],
};
