// cards/ct-p07/B07089 米原桜子 (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚特徴［警察］〛か〚［探偵］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。
// 句マッピング:
//   - 【宣言】 => type:'declared' [src/cards/ct-p04/B04047.ts a1 = {type:'declared',scope:'on-scene'} on a 【宣言】 scene character. capability-map §3 AbilityType 'declared' = player-declared, cost paid then runs effect (rules/21).]
//   - 【ターン1】 => limit:{kind:'turn',n:1} [src/cards/ct-p04/B04047.ts a1 / src/cards/ct-p08/B08009.ts a1 both use limit:{kind:'turn',n:1} on a declared ability. capability-map §B: 【ターンN】 enforced via declaredUseCount per source uid+abilityId.]
//   - 【スリープ】 (このキャラ自身をスリープ) => cost:{kind:'sleepSelf'} [src/cards/ct-p04/B04047.ts a1 + src/cards/ct-p03/B03021.ts a1 = bare cost:{kind:'sleepSelf'} on declared. capability-map §1: sleepSelf sleeps ctx.source.uid, payable only if active (sleep/stun unpayable) — matches rules/21 cost-must-be-fully-paid.]
//   - 自分のデッキのカードを上から1枚公開する => atom deckRevealUntil {player:'self', filter:{trait:['警察','探偵'],kind:'character'}, maxN:1, bind:'$revealed', bindMatch:'$matched'} [src/cards/ct-p01/B01013.ts a1 = identical deckRevealUntil{maxN,filter,bind:'$revealed',bindMatch:'$matched'}. src/engine/effect/atom-handlers.ts:1054-1062 maxN branch: lookN=min(deck.length,1) reveals top 1 into 'revealed', then first filter match → 'matched'. filter trait-array OR + kind honored by targetFilterToPredicate (atom-handlers.ts:69-86): trait wants.some(w=>d.traits?.includes(w)) AND d.kind===filter.kind (BUG-117/118 fixed).]
//   - 公開したカードが〚特徴［警察］〛か〚［探偵］〛のキャラの場合、手札に加える => conditional{if:bound $matched matched} → atom handAddFromDeck {player:'self', cardId:'$matched.cardId'} [src/cards/ct-p01/B01013.ts a1 / src/cards/ct-p05/B05017.ts a1 / src/cards/ct-p03/B03018.ts a1 = identical conditional{if:{kind:'bound',key:'$matched',presence:'matched'}} → handAddFromDeck{cardId:'$matched.cardId'}. src/engine/effect/atom-handlers.ts:403-423 splices matched cardId out of deck → mutate.hand.add. trait-OR (警察 OR 探偵) + kind:character from the deckRevealUntil filter (same predicate). cond/eval bound presence:'matched' = $matched is non-empty array (capability-map §Conditions bound).]
//   - 公開したカードがそれ以外の場合、デッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [src/engine/effect/atom-handlers.ts:1080-1093: with maxN set, when matched!==null the matched card is removed from $revealed (restIds=[] for maxN:1) so deckToBottomBound is a no-op; when no match $revealed holds the 1 revealed card → atom-handlers.ts:1120-1140 splices it from deck and mutate.deck.toBottom. This yields mutually-exclusive 手札 vs デッキ下 routing exactly matching the official 'それ以外の場合' branch. Exemplar src/cards/ct-p01/B01013.ts a1 / src/cards/ct-p03/B03018.ts a1 use identical deckToBottomBound{bindKey:'$revealed'} as the trailing remainder step.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: {
            trait: [
              '警察',
              '探偵'
            ],
            kind: 'character'
          },
          maxN: 1,
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
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId'
          }
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
  },
  description: '【宣言】【ターン1】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚特徴［警察］〛か〚［探偵］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B07089: CardDef = {
  id: 'B07089',
  no: '0817/B07089',
  kind: 'character',
  names: [
    '米原桜子'
  ],
  colors: [
    '黄'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '家政婦'
  ],
  rarity: 'C',
  imageUrl: '1762414027468273.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
