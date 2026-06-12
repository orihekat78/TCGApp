// cards/pr-01/PR045 大岡紅葉 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【登場時】手札から【緑】のイベントを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
// 句マッピング:
//   - 【登場時】 => type:'triggered', scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [hook 'enter' (登場時) emitted by sceneEnter + selfOnly via source.uid — capability-map hooks §enter; exemplars src/cards/pr-01/PR138.ts a1 and src/cards/ct-d02/D02002.ts a1 both use trigger:{hook:'enter',selfOnly:true} for 【登場時】]
//   - 手札から【緑】のイベントを1枚リムーブしてもよい => chain step1: atom discard {player:'self', max:1, filter:{color:'緑', kind:'event'}} [discard verb args {player,n?/max?,filter?} — capability-map verbs §discard. atom-handlers.ts:267-306 discard builds short-form pick via buildShortFormPick(ATOM_PICK_SPEC.discard.defaultArea='hand', a, dcP, dcP) when target absent + max present; atom-pick-spec.ts:78 passes a.filter→query.filter. max:1 → n:{min:0,max:1} = 0-pick legal = 「1枚まで…してもよい」. color+kind filter honored by candidates.ts matchOneFilter (color line: d.colors.includes; kind line: d?.kind!==filter.kind → both CardDef-driven, valid for hand 'card' candidates). Exemplar src/cards/ct-d02/D02002.ts a1 uses discard {player:'self', max:1} as the 「1枚リムーブしてもよい」 step (filter-less); filtered discard color is new but grounded in matchOneFilter]
//   - そうした場合、 => chain wrapper ('そうした場合' break semantics) [resolver.ts:59-82 chain: after each step checks g.__chainStepNoApply; if step had no candidate → break (skip later steps). resolve-picks.ts:434-437/478-481 sets __chainStepNoApply=true when discard pick has 0 candidates. apply-pick.ts:272-275 drainAiEffectPicks: pickedUid===null (0-pick skip) drops paired continuation → draw not run. So draw fires only if a 緑 event was actually removed (D02002 a1 is the same chain[discard-max1, X] 「そうした場合」 twin)]
//   - カードを2枚引く。 => chain step2: atom draw {player:'self', n:2} [draw verb args {player,n:number} — capability-map verbs §draw (mutate.deck.draw → hand). Exemplars src/cards/ct-p03/B03026.ts, B03043.ts, B03064.ts, B03082.ts all use draw {player:'self', n:2}]

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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          max: 1,
          filter: {
            color: '緑',
            kind: 'event'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 2
        }
      }
    ]
  },
  description: '【登場時】手札から【緑】のイベントを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const PR045: CardDef = {
  id: 'PR045',
  no: '0399/PR045',
  kind: 'character',
  names: [
    '大岡紅葉'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'PR',
  imageUrl: '1727333980438394.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
