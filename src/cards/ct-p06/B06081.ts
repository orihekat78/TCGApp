// cards/ct-p06/B06081 保本ひかる (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/11-reasoning.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   自分のターン終了時、自分の現場にいる〚カード名［保本ひかる］〛以外のキャラを1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。
// 句マッピング:
//   - 自分のターン終了時 => trigger {hook 'phase:end:start'} + condition:{kind 'turn',player:'self'} [src/cards/ct-d08/D08003.ts a2 and src/cards/ct-p07/B07021.ts a1 use the exact same shape for the identical '自分のターン終了時' opener. capability-map line 314-315 + src/engine/effect/atom-handlers.ts hook list: phase:end:start emitted by flow/turn.ts, payload {player}, source undefined => selfOnly UNUSABLE, must gate via condition turn:self on payload.player. cond/eval.ts case 'turn' = current turn player === resolvePlayer('self').]
//   - 自分の現場にいる…キャラを1枚リムーブ => atom sceneRemove{player:'self', max:1, side:'self', cause:'effect', filter:{...}} [src/cards/ct-p01/B01065.ts a1 step2 / src/cards/ct-p04/B04049.ts a1 / src/cards/ct-d08/D08003.ts a1 step2 all use sceneRemove short-form {player, max:1, side, cause:'effect', filter}. atom-handlers.ts:884-906 case 'sceneRemove': uid absent + max => paShortFormAwait builds PA pick; buildShortFormPick (atom-pick-spec.ts:69-114) passes side:'self' (own scene only) + filter + max:1 => n:{min:0,max:1}. removeToRemove(cause). max:1 => 0-skip path absorbed by outer optional (established idiom).]
//   - 〚カード名［保本ひかる］〛以外 => filter:{cardNameNot:'保本ひかる', kind 'character'} [cluster16. src/engine/types/effect.ts:108 defines TargetFilter.cardNameNot?:string|string[]. Honored at matchOneFilter (src/engine/target/candidates.ts:268-274 — canonical all-area pick path, including sceneRemove's PA pick). Uses allCardNameComponentsForDef (split-name rules/19) so single-name 保本ひかる excluded; name-based (not uid excludeSelf) so a 2nd 保本ひかる copy is also excluded — matches '以外'. kind 'character' honored same site (BUG-118). No live card uses it yet (cluster16 first ship).]
//   - リムーブしてもよい => optional wrapper [Brief DSL convention: 「してもよい」 = optional. src/cards/ct-d04/D04007.ts a2, src/cards/ct-d09/D09010.ts a1, src/cards/ct-p01/B01065.ts a1 all wrap with kind 'optional'. resolver.ts case 'optional' runs inner only when ctx.dyn.optionalRun===true (opt-in surface). AI never auto-takes optional (accepted known limitation).]
//   - そうした場合、自分は証拠を1つ得る => chain[ sceneRemove(step1), evidenceGain{player:'self',n:1}(step2) ] [VERBATIM twin pattern in src/cards/ct-d04/D04007.ts a2 and src/cards/ct-d09/D09010.ts a1: optional{chain[<remove>, evidenceGain{player:'self',n:1}]}. 'そうした場合' = chain front-step gate: resolver.ts:79-81 breaks chain when __chainStepNoApply; resolve-picks.ts:543 sets it on 0-candidate, and a player decline (0 picked, NON-skipResolvesAtom pending) drops the continuation (apply-pick.ts:51,134; sceneRemove never sets skipResolvesAtom which is only set for deckRevealUntil/B09010). => evidence only when a char was actually removed. evidenceGain verb (validate.ts:24) = mutate.evidence.addFromDeck; uses n:1 (NOT max — evidenceGain has no pick spec, max would give 0, per B01069/B01065 note).]

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
            player: 'self',
            max: 1,
            side: 'self',
            cause: 'effect',
            filter: {
              cardNameNot: '保本ひかる',
              kind: 'character'
            }
          }
        },
        {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '自分のターン終了時、自分の現場にいる〚カード名［保本ひかる］〛以外のキャラを1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B06081: CardDef = {
  id: 'B06081',
  no: '0701/B06081',
  kind: 'character',
  names: [
    '保本ひかる'
  ],
  colors: [
    '赤'
  ],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: [
    'お手伝い'
  ],
  rarity: 'C',
  imageUrl: '1754285244573571.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
