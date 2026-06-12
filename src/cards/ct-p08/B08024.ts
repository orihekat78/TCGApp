// cards/ct-p08/B08024 服部静華 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。\n【宣言】【ターン2】自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、自分のデッキのカードを上から3枚見る。その中から【緑】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
// 句マッピング:
//   - 【登場時】 => triggered trigger:{hook:'enter',selfOnly:true}, scope:on-scene [src/cards/ct-p08/B08034.ts a1 enter selfOnly; hooks ref: enter payload {uid,viaEffect,...} selfOnly=source.uid (capability-map hooks section)]
//   - 自分のデッキのカードを上から1枚裏向きでこのキャラにセットする => atom charSetCard {uid:'$self', fromDeckTop:true, faceUp:false, player:'self'} [src/cards/ct-p08/B08054.ts a2 uses charSetCard{uid:'$self',fromDeckTop:true,faceUp:false,player:'self'}; atom-handlers.ts:895-907 fromDeckTop shifts deck top→setCard onto resolved uid; resolveBindRef '$self'→ctx.source.uid (atom-handlers.ts:146-148)]
//   - 【宣言】【ターン2】 => type:'declared', limit:{kind:'turn',n:2}, no cost (no ':' in text → costless) [card-def.ts:100 cost?:Cost optional, :103 limit?:AbilityLimit, AbilityLimit allows {kind:'turn',n:2} (card-def.ts:37); costless declared exemplars exist (e.g. src/cards/ct-p02/B02030.ts); cost/evaluate.ts canPay only invoked when cost present]
//   - 自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい => chain step1 atom charRemoveSetCard {player:'self', max:1, side:'either', filter:{hasSetCards:true}} (max:1→0-pick legal = してもよい) [src/cards/ct-p08/B08034.ts a2 charRemoveSetCard{player:'self',max:1,...,filter:{hasSetCards:true}}; atom-handlers.ts:643-667 short-form pick; buildShortFormPick (atom-pick-spec.ts:72) honors a.side override → side:'either' enumerates BOTH scenes; candidates.ts:296-299 hasSetCards filter honored for scene chars; max:1 skip→'$pick' silent no-op]
//   - そうした場合 (gate the rest on having removed a set card) => chain semantics: step1 no-candidate/skip → __chainStepNoApply → step2 skipped [resolver wrappers 'chain' = 「そうした場合」semantics (capability-map sec C / wrappers); resolve-picks.ts:436,480 set __chainStepNoApply on no-candidate; B08034.ts a2 uses bare chain for してもよい/そうした場合 with charRemoveSetCard]
//   - 自分のデッキのカードを上から3枚見る。その中から【緑】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す => deckRevealUntil {player:'self',filter:{color:'緑'},maxN:3,bind:'$revealed',bindMatch:'$matched'} → conditional(bound $matched matched → handAddFromDeck $matched.cardId) → deckToBottomBound $revealed [src/cards/ct-d01/D01013.ts a1 (identical shape, maxN=4/color:青) and src/cards/ct-p01/B01013.ts; atom-handlers deckRevealUntil filter honors color (capability-map deckRevealUntil); bound condition + handAddFromDeck cardId:'$matched.cardId' + deckToBottomBound bindKey:'$revealed' wired per D01013]
//   - カードを手札に加えた場合、手札を1枚リムーブする => inner conditional then-sequence: after handAddFromDeck → atom discard {player:'self',n:1} [src/cards/ct-d01/D01013.ts a1 conditional(if bound $matched matched){then sequence[handAddFromDeck, discard n:1]} — exact same trailing-discard pattern; discard verb (capability-map atom verbs, Pattern B hand pick)]

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
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      uid: '$self',
      fromDeckTop: true,
      faceUp: false,
      player: 'self'
    }
  },
  description: '【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 2
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'charRemoveSetCard',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          filter: {
            hasSetCards: true
          }
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
                color: '緑'
              },
              maxN: 3,
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
                    cardId: '$matched.cardId'
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
  },
  description: '【宣言】【ターン2】自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、自分のデッキのカードを上から3枚見る。その中から【緑】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B08024: CardDef = {
  id: 'B08024',
  no: '0864/B08024',
  kind: 'character',
  names: [
    '服部静華'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [],
  rarity: 'R',
  imageUrl: '1770731204455253.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
