// cards/ct-p01/B01065P 沖矢昴 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】相手に証拠を1つ与えてもよい。そうした場合、レベル5以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【相手ターン中】 => a1.condition {kind 'turn', player:'opp'} [src/cards/ct-p03/B03079.ts a1 and src/cards/ct-p01/B01018.ts a1 BOTH use {kind 'turn',player:'opp'} for the word-for-word identical '【相手ターン中】【現場リムーブ時】' opener. eval.ts (cap-map L139) case 'turn' = current turn player === resolvePlayer('opp'). Evaluated on the leave handler via evalCond (per B03079 mapping note citing triggered.ts handleLeaveToRemoveSelf).]
//   - 【現場リムーブ時】(このキャラ自身) => a1.trigger {hook 'leave:to-remove', selfOnly:true}, scope 'on-scene' [src/cards/ct-p03/B03079.ts a1 and src/cards/ct-p01/B01018.ts a1 use identical {hook 'leave:to-remove', selfOnly:true} for the same printed ability. cap-map hooks L292-293: 'leave:to-remove' is a registered card-triggerable hook; handleLeaveToRemoveSelf builds the removed card's own 現場リムーブ時 (virtual scene location), selfOnly via source.uid. validate.ts L26 sceneRemove etc. — leave:to-remove printing is allowed (only GRANTING the hook is forbidden).]
//   - 相手に証拠を1つ与えてもよい => a1.effect = optional wrapping a sequence; first inner step atom evidenceGain {player:'opp', n:1} [src/cards/ct-p01/B01069.ts a1 is the EXACT text-twin '相手に証拠を1つ与えてもよい。そうした場合、…' and uses {kind 'optional', effect:{kind 'sequence', steps:[ {verb 'evidenceGain', args:{player:'opp', n:1}}, ... ]}}. cap-map verbs L21: evidenceGain args {player,n} -> mutate.evidence.addFromDeck; resolvePlayer('opp') -> opponent-of-owner. CRITICAL (copied from B01069 note): evidenceGain is NOT in ATOM_PICK_SPEC, so must use n:1 (NOT max:1 — max would build no pick and give 0 evidence). validate.ts L24 evidenceGain registered. 「してもよい」 -> optional wrapper (brief DSL convention; AI never auto-takes optional, accepted limitation per B01069/B04049 green).]
//   - そうした場合、レベル5以下のキャラを1枚まで選び、リムーブする => second inner step atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:5}} [src/cards/ct-p07/B07067.ts a1 maps 'レベル8以下のキャラを1枚まで選び、リムーブする' to sceneRemove {player:'self', max:1, side:'either', filter:{levelMax:8}} (comment: max:1=0枚可 / side:'either'=両者現場 rules/15). src/cards/ct-p04/B04049.ts a1 (also 沖矢昴, trait 大学院生) maps 'そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする' to sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:7}} inside an optional. atom-handlers.ts case 'sceneRemove' L883: uid absent + hasNorMax -> paShortFormAwait builds Pattern-A pick (chooser=resolvePlayer('self')=owner), max:1 => min 0 skippable; 0-pick -> '$pick' reaches handler -> silent no-op 'skipped' (L891). levelMax honored by matchOneFilter (D09020 a1 confirms levelMax:5 in pick filter). 「そうした場合」 governed by the optional opt-in (B01069 pattern) — evidenceGain is non-pick so it never chain-breaks; both clauses inside one optional => opt-in runs both, opt-out runs neither.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。 => a2 {type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect: sceneSetState {uid:'$pick', state:'sleep', target:{kind 'pick', query:{area:'scene', side:'either'}, n:{min:0,max:1}, chooser:'self'}}} [src/cards/ct-p03/B03079.ts a2 is BYTE-IDENTICAL to this card's hirameki text and uses exactly this AbilityDef. cap-map hooks L324-326: evidence:remove-by-action + trigger.optional:true routes to pendingHirameki side-channel (fire/skip = 任意発動 rules/10). atom-handlers.ts sceneSetState Pattern-A short-form (uid:'$pick' + state + n/max) -> scene pick; n.min:0 = 1枚まで (0-pick legal rules/15); side:'either' = どちらの現場も対象 (rules/15). validate.ts L26 sceneSetState registered.]

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
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'opp',
            n: 1
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
              levelMax: 5
            }
          }
        }
      ]
    }
  },
  description: '【相手ターン中】【現場リムーブ時】相手に証拠を1つ与えてもよい。そうした場合、レベル5以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const B01065P: CardDef = {
  id: 'B01065P',
  no: '0055/B01065P',
  kind: 'character',
  names: [
    '沖矢昴'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '大学院生'
  ],
  rarity: 'RP',
  imageUrl: '1714013053499763.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
