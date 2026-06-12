// cards/ct-p01/B01069 赤井務武 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/10-action-event.md
// 公式テキスト:
//   【登場時】相手に証拠を1つ与えてもよい。そうした場合、カードを1枚引く。
// 句マッピング:
//   - 【登場時】 => triggered ability, trigger {hook:'enter', selfOnly:true}, scope:'on-scene' [capability-map hooks: `enter` = char登場時(【登場時】), selfOnly ✅ (source.uid); exemplar src/cards/ct-p02/B02061.ts a1 (enter/selfOnly) and src/cards/ct-p05/B05019.ts trigger shape]
//   - 相手に証拠を1つ与えてもよい => {kind:'optional'} wrapping a sequence whose first step is atom evidenceGain {player:'opp', n:1} [evidenceGain handler src/engine/effect/atom-handlers.ts:318-324 reads `a.n as number` and calls mutate.evidence.addFromDeck(p, n); resolvePlayer('opp') (atom-handlers.ts:116-123) returns opponent-of-owner; n-path identical to self uses in src/cards/ct-d11/D11003.ts:24 / ct-d08/D08013.ts:25. 「してもよい」 → optional wrapper per brief; exemplar src/cards/ct-p05/B05019.ts ({kind:'optional', effect:{kind:'sequence', steps:[...]}}). NOTE: did NOT copy B02061's `max:1` form — evidenceGain is NOT in ATOM_PICK_SPEC (src/engine/effect/atom-pick-spec.ts), so `max:1` builds no pick and yields n=undefined → addFromDeck loop runs 0 times (gives 0 evidence). Used n:1 instead.]
//   - そうした場合、カードを1枚引く => second step of the optional's sequence: atom draw {player:'self', n:1} (runs only if the player opts into the optional, so 'そうした場合' = opted-in) [capability-map verbs: draw args {player, n} = mutate.deck.draw; exemplar src/cards/ct-p02/B02061.ts a2 (draw {player:'self', n:1}). sequence runs steps in order (capability-map WRAPPERS: sequence); both atoms are non-pick so neither pauses. Putting both give-evidence + draw inside one optional makes 'そうした場合' hold: opt-in → both happen, opt-out → neither.]

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
          verb: 'draw',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '【登場時】相手に証拠を1つ与えてもよい。そうした場合、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B01069: CardDef = {
  id: 'B01069',
  no: '0059/B01069',
  kind: 'character',
  names: [
    '赤井務武'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '赤井家'
  ],
  rarity: 'C',
  imageUrl: '1714013053513103.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/10-action-event.md'
  ],
};
