// cards/ct-p07/B07073P ジェイムズ・ブラック (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のデッキのカードを上から4枚見る。その中から【赤】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
// 句マッピング:
//   - 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する） => __shared misreadX{x:1,abilityId:'a1'} (type 'icon-misread') [src/cards/_shared/misreadX.ts (icon-misread, effect noop marker); live use src/cards/ct-d05/D05011.ts abilities[0]=misreadX({x:1,abilityId:'a1'}); engine src/engine/listeners/misread.ts consumes reasoning:before-add → sleep + LP-X; codegen whitelist scripts/taskA-codegen.cjs:103 SHARED_FNS includes misreadX]
//   - 【登場時】 => trigger{hook 'enter',selfOnly:true}, scope 'on-scene', type 'triggered' [exemplar src/cards/ct-d01/D01013.ts a1 trigger {hook 'enter',selfOnly:true}; capability-map hook 'enter' (selfOnly=source.uid match); atom-handlers sceneEnter emits enter hook]
//   - 手札を1枚リムーブしてもよい。そうした場合、… => effect:{kind 'optional',effect:{kind 'chain',steps:[discard{n:1}, <body>]}} — opt-in then forced discard 1 gates body via 'そうした場合' chain semantics [optional{chain[...]} pattern grounded src/cards/ct-p04/B04023.ts a1 (このキャラをリムーブしてもよい。そうした場合 = optional{chain[selfRemove, pick]}); leading discard-gates-chain grounded src/cards/ct-d08/D08003.ts a1 (chain[discard, sceneRemove]); discard{n:1} = forced 1-card pick (src/engine/effect/atom-handlers.ts:249-287 buildShortFormPick); empty-hand sets __chainStepNoApply → chain break (src/engine/effect/resolve-picks.ts:436-481, resolver.ts:79-82); AI always skips optional (capability-map §optional — known behavior, see notes)]
//   - 自分のデッキのカードを上から4枚見る。 => atom deckRevealUntil{player:'self',filter:{color:'赤'},maxN:4,bind:'$revealed',bindMatch:'$matched'} [EXACT structural match src/cards/ct-d01/D01013.ts a1 / src/cards/ct-d03/D03009.ts a1 (maxN:4); capability-map deckRevealUntil honors color filter (printed value, BUG-117/118), reveals min(deck,maxN) then binds remainder→$revealed, first match→$matched]
//   - その中から【赤】のカードを1枚まで公開して手札に加え、 => conditional{if:bound($matched,matched), then:handAddFromDeck{cardId:'$matched.cardId'}} [src/cards/ct-d01/D01013.ts a1 (conditional bound $matched → handAddFromDeck '$matched.cardId'); filter color:'赤' (no kind restriction = 【赤】のカード covers character+event, matching official 'カード'); capability-map handAddFromDeck splices $matched.cardId deck→hand]
//   - 残りを好きな順番でデッキの下に移す。 => atom deckToBottomBound{player:'self',bindKey:'$revealed'} [src/cards/ct-d01/D01013.ts a1 deckToBottomBound bindKey:'$revealed'; capability-map deckToBottomBound moves bound cardIds deck→bottom; '好きな順番' = AI given-order / human UI choice (approximation, rules-legal)]
//   - カードを手札に加えた場合、手札を1枚リムーブする。 => (inside same conditional) sequence[handAddFromDeck, discard{n:1}] — forced discard gated on $matched present [EXACT match src/cards/ct-d01/D01013.ts a1 / D03009.ts a1: conditional(bound $matched)→sequence[handAddFromDeck, discard{n:1}]; trailing discard is 必須 (n:1, not max) per official '〜する'; only runs when a card was added (bound $matched matched)]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
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
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'deckRevealUntil',
              args: {
                chooseMatch: 'upTo',
                player: 'self',
                filter: {
                  color: '赤'
                },
                maxN: 4,
                bind: '$revealed',
                bindMatch: '$matched'
              }
            },
            {
              kind: 'conditional',
              if: {
                kind: 'bound',
                key: '$matched',
                presence: 'matched'
              },
              then: {
                kind: 'sequence',
                steps: [
                  {
                    kind: 'atom',
                    verb: 'handAddFromDeck',
                    args: {
                      player: 'self',
                      cardId: '$matched.cardId',
                      presentation: 'public-selected-card'
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
              }
            },
            {
              kind: 'atom',
              verb: 'deckToBottomBound',
              args: {
                player: 'self',
                bindKey: '$revealed'
              }
            }
          ]
        }
      ]
    }
  },
  description: '【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のデッキのカードを上から4枚見る。その中から【赤】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B07073P: CardDef = {
  id: 'B07073P',
  no: '0802/B07073P',
  kind: 'character',
  names: [
    'ジェイムズ・ブラック'
  ],
  colors: [
    '赤'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'CP',
  imageUrl: '1763546825782149.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
