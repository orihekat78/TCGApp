// cards/ct-p07/B07094 ジン (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）\n【パートナー黒】自分のターン終了時、手札を1枚リムーブし、自分の現場にいるレベル7以下のキャラを1枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる） => CardDef top-level keywords:['突撃[事件]'] (innate, unconditional printed keyword — NOT an AbilityDef) [src/engine/flow/main/action.ts:56 namedExceptionAllowed reads readChar.keywords and checks kws.includes('突撃[事件]') (ASCII brackets) for the 名乗り action[事件] exception. read/keyword.ts defHasKeyword returns true when def.keywords[] includes the string. Exemplar for printed-keyword convention: src/cards/ct-p09/B09037.ts keywords:['突撃[キャラ]'] (unconditional printed 突撃[キャラ] → ASCII brackets in keywords[]); src/cards/ct-p03/B03014.ts shows a character with innate keywords:['突撃'] coexisting with a phase:end:start ability. Note: 突撃[事件] here is UNCONDITIONAL (no 【パートナー】 prefix) unlike B08007 — so top-level keywords[], not partnerColorKeyword.]
//   - 【パートナー黒】 => condition (and-combined): {kind:'partnerColor', color:'黒'} [capability-map condition 'partnerColor {color}' (cond/eval.ts) = owner's partner CardDef.colors intersects color. Exemplar combining partnerColor inside an `and`: src/cards/ct-p05/B05067.ts a2 condition:{kind:'and',cs:[{kind:'partnerColor',color:'赤'},...]}. partnerColor alongside a triggered ability: src/cards/ct-d08/D08003.ts a1.]
//   - 自分のターン終了時 => trigger:{hook:'phase:end:start'} + condition {kind:'turn',player:'self'} (and-combined; phase:end:start fires on BOTH turns so a turn gate is required, and selfOnly is unusable since this hook's source is undefined) [capability-map hooks: phase:end:start source undefined → gate by condition turn, NOT selfOnly. Exemplar: src/cards/ct-d08/D08003.ts a2 and src/cards/ct-p07/B07021.ts a1 both use trigger:{hook:'phase:end:start'} + condition:{kind:'turn',player:'self'} for 自分のターン終了時. resolver/listeners emit phase:end:start with payload{player} each turn-end (src/engine/flow/turn.ts).]
//   - 手札を1枚リムーブし、…してもよい (してもよい governs the whole compound action) => {kind:'optional', effect:{kind:'chain', steps:[discard, ...]}} — outer optional opt-in; first chain step atom discard {player:'self', n:1} [Brief: コスト風前置「手札1枚リムーブしてもよい→」= {kind:'optional',effect:{kind:'chain',steps:[discard-step, X]}}. Exemplar src/cards/ct-p06/B06052.ts a1 = optional{chain[{verb:'discard',args:{player:'self',n:1}}, ...]} (公式『手札を1枚リムーブしてもよい。そうした場合…』, exactly the n:1 forced-discard-inside-optional shape). discard short-form: atom-pick-spec.ts ATOM_PICK_SPEC.discard {defaultArea:'hand',mode:'PB'}; n:1 → buildShortFormPick nMin=nMax=1 (exactly 1). AI/CPU always skips optional (known, noted).]
//   - 自分の現場にいるレベル7以下のキャラを1枚リムーブ => chain step atom sceneRemove {player:'self', n:1, side:'self', cause:'effect', filter:{levelMax:7}} [atom-handlers.ts:614 sceneRemove short-form (uid absent + player + n/max) builds PA pick via buildShortFormPick('scene', a, srP, srP); side defaults to player, explicit side:'self' passed through; filter{levelMax:7} honored by target/candidates.ts:294 matchOneFilter (level <= levelMax). n:1 = forced exactly 1 (own scene; ジン itself is level 8 so excluded by levelMax:7). Exemplar sceneRemove with levelMax filter: src/cards/ct-p04/B04049.ts a1 sceneRemove{filter:{levelMax:7}} (同型 'レベル7以下を…リムーブ').]
//   - そうした場合、キャラを1枚まで選び、リムーブする => final chain step atom sceneRemove {player:'self', max:1, side:'either', cause:'effect'} — gated by chain 「そうした場合」 no-candidate-break semantics [capability-map chain: after each step checks __chainStepNoApply; a no-candidate step breaks the chain (resolve-picks.ts:436/480 set __chainStepNoApply; resolver.ts:79 breaks). So if the discard or own-scene-remove finds nothing, the follow-up is skipped (= そうした場合). max:1 → buildShortFormPick nMin=0,nMax=1 (キャラを1枚まで=0OK, rules/15). side:'either' = どちらの現場のキャラでも選べる (rules/15 default; no filter). Exemplar src/cards/ct-d08/D08003.ts a1 step2 sceneRemove{player:'self',max:1,side:'either',...} as the 『そうした場合…1枚までリムーブ』 follow-up; src/cards/ct-p04/B04049.ts a1 final chain-step is the identical 『そうした場合…1枚まで選びリムーブ』 sceneRemove.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'self'
      },
      {
        kind: 'partnerColor',
        color: '黒'
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
            n: 1,
            side: 'self',
            cause: 'effect',
            filter: {
              levelMax: 7
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
            cause: 'effect'
          }
        }
      ]
    }
  },
  description: '【パートナー黒】自分のターン終了時、手札を1枚リムーブし、自分の現場にいるレベル7以下のキャラを1枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B07094: CardDef = {
  id: 'B07094',
  no: '0821/B07094',
  kind: 'character',
  names: [
    'ジン'
  ],
  colors: [
    '黒'
  ],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'SR',
  imageUrl: '1762414027528955.jpg',
  keywords: [
    '突撃[事件]'
  ],
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
