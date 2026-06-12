// cards/ct-p03/B03069 羽田浩司 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/11-reasoning.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   自分の証拠が3つ以下の場合、このキャラをLP＋1する。\n【相手ターン中】【現場リムーブ時】証拠を1つ得てもよい。そうした場合、相手に証拠を1つ与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【赤】のカードを1枚まで選び、手札に加える。
// 句マッピング:
//   - 自分の証拠が3つ以下の場合、このキャラをLP＋1する。 => type:'continuous' + condition:not(evidenceAtLeast{player:'self',n:4}) (=証拠≤3) + continuousModifier:{lpDelta:1} [continuous lpDelta+self-condition shape copied from src/cards/ct-p03/B03054.ts a1 ({type:'continuous',scope:'on-scene',condition:{kind:'sceneHas',...},continuousModifier:{lpDelta:1}}). 'not' verified !evalCond(inner) at src/engine/cond/eval.ts:28; 'evidenceAtLeast' verified state.players[resolvePlayer(player)].evidence.length>=n at eval.ts:103-105 → not(>=4) = <4 = ≤3. continuous is owner($self)-only bearer modifier per capability-map §3 (no aura needed — only this char).]
//   - 【相手ターン中】【現場リムーブ時】 (trigger shell) => type:'triggered', condition:{kind:'turn',player:'opp'}, trigger:{hook:'leave:to-remove',selfOnly:true}, scope:'on-scene' [Exact structural twin: src/cards/ct-p02/B02004.ts a2 (condition turn:opp + trigger leave:to-remove selfOnly). Self-leave fires via handleLeaveToRemoveSelf at src/engine/listeners/triggered.ts:302 which evaluates selfOnly+condition. capability-map hooks: leave:to-remove (現場リムーブ時 any cause), selfOnly ✅.]
//   - 証拠を1つ得てもよい。そうした場合、相手に証拠を1つ与える。 => {kind:'optional', effect:{kind:'sequence', steps:[evidenceGain{player:'self',n:1}, evidenceGain{player:'opp',n:1}]}} [optional+sequence+evidenceGain pattern copied from src/cards/ct-p01/B01069.ts a1 ('相手に証拠を与えてもよい。そうした場合〜' = optional wrapping a sequence; opt-in→both steps, opt-out→neither — exactly 'してもよい/そうした場合'). evidenceGain verified at src/engine/effect/atom-handlers.ts:318-324: resolvePlayer(a.player) + mutate.evidence.addFromDeck(s,p,n); n=a.n as number (NOT a pick verb, so use literal n:1, per B01069 note). 'optional' runs only on ctx.dyn.optionalRun===true else skip — src/engine/effect/resolver.ts:104-106.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【赤】のカードを1枚まで選び、手札に加える。 => type:'triggered', scope:'on-evidence', trigger:{hook:'evidence:remove-by-action',optional:true}, effect:atom handAddFromRemove{player:'self',max:1,filter:{color:'赤'}} [Hirameki+handAddFromRemove shape copied from src/cards/ct-p03/B03012.ts a2 (same 【ヒラメキ】 on evidence:remove-by-action optional, handAddFromRemove max:1 filter) and src/cards/ct-p09/B09029.ts a2 (handAddFromRemove filter by attribute, max:1). color filter honored: matchOneFilter applies filter.color via lookupCardDef(cardId).colors at src/engine/target/candidates.ts:253-256 (works for remove-area 'card' candidates, no scene char needed). Text says 'カード' (any kind) so NO kind filter added. capability-map verbs: handAddFromRemove short-form remove pick (defaultArea=remove).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'not',
    c: {
      kind: 'evidenceAtLeast',
      player: 'self',
      n: 4
    }
  },
  continuousModifier: {
    lpDelta: 1
  },
  description: '自分の証拠が3つ以下の場合、このキャラをLP＋1する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  trigger: {
    hook: 'leave:to-remove',
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
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'opp',
            n: 1
          }
        }
      ]
    }
  },
  description: '【相手ターン中】【現場リムーブ時】証拠を1つ得てもよい。そうした場合、相手に証拠を1つ与える。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        color: '赤'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【赤】のカードを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B03069: CardDef = {
  id: 'B03069',
  no: '0323/B03069',
  kind: 'character',
  names: [
    '羽田浩司'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '棋士'
  ],
  rarity: 'R',
  imageUrl: '1729133424816676.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
