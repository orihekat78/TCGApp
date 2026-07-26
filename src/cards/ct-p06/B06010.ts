// cards/ct-p06/B06010 中道 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛：自分のデッキのカードを上から〚特徴［高校生］〛のキャラが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - 【宣言】 => AbilityDef type:'declared', scope:'on-scene' [capability-map §3 declared type (player-declared, cost paid then effect runs); exemplar src/cards/ct-p04/B04023.ts a2 type:'declared' scope:'on-scene'; declaredUseCount tracked per source]
//   - 〚デッキの下に移す〛 (cost) => cost:{kind:'selfToDeckBottom'} [exemplar src/cards/ct-p03/B03011.ts cost:{kind:'selfToDeckBottom'} for 「〚デッキの下に移す〛」; confirmed in src/engine/cost/evaluate.ts:49 (canPay: findChar(uid)) and src/engine/cost/pay.ts:90 (mutate.scene.toDeckBottom(state,uid)); cost対象=自身省略 rules/21]
//   - 自分のデッキのカードを上から〚特徴［高校生］〛のキャラが出るまで1枚ずつ公開し => atom deckRevealUntil {player:'self', filter:{trait:'高校生',kind:'character'}, bind:'$revealed', bindMatch:'$matched'} (NO maxN = reveal 1-by-1 until match) [src/engine/effect/atom-handlers.ts:1037 deckRevealUntil — maxN-未指定 branch: 'for (const cardId of deck){revealed.push; if(filter(cardId)){matched=cardId;break}}' = 1枚ずつ公開し match で停止. filter via targetFilterToPredicate (atom-handlers.ts:57-86) honors trait (d.traits.includes) + kind (d.kind===filter.kind, BUG-118). exemplar D11019.ts a1 uses deckRevealUntil WITHOUT maxN ('出るまで1枚ずつ公開'); exemplar B04023.ts a2 uses same filter shape {trait,kind:'character'}]
//   - それを手札に加える => conditional{if:bound $matched matched, then: atom handAddFromDeck {player:'self', cardId:'$matched.cardId'}} [src/engine/effect/atom-handlers.ts:403 handAddFromDeck — resolveBindRef('$matched.cardId') → splice from deck → mutate.hand.add. exemplar B04023.ts a2 / B01013.ts identical conditional+handAddFromDeck '$matched.cardId'. conditional bound-matched guard handles deck-没-高校生 edge (no match → skip, rules/15 可能な限り)]
//   - 残りの公開したカードをデッキの下に移し => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [src/engine/effect/atom-handlers.ts (case 'deckToBottomBound') — splices bound cardIds from deck then mutate.deck.toBottom. $revealed binding (atom-handlers.ts ~1080 restIds = revealed.slice(0,-1) in no-maxN path) EXCLUDES the matched card → only the non-match reveals go to bottom. exemplar B04023.ts a2 / D11019.ts a1 deckToBottomBound bindKey:'$revealed']
//   - デッキをシャッフルする => atom deckShuffle {player:'self'} [src/engine/effect/atom-handlers.ts (case 'deckShuffle') mutate.deck.shuffle(s,p,ctx.rng). exemplar D11019.ts a1 final step deckShuffle {player:'self'} for identical '残りをデッキ下に移し、デッキをシャッフルする' wording]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'selfToDeckBottom'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filter: {
            trait: '高校生',
            kind: 'character'
          },
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
      },
      {
        kind: 'atom',
        verb: 'deckShuffle',
        args: {
          player: 'self'
        }
      }
    ]
  },
  description: '【宣言】〚デッキの下に移す〛：自分のデッキのカードを上から〚特徴［高校生］〛のキャラが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06010: CardDef = {
  id: 'B06010',
  no: '0635/B06010',
  kind: 'character',
  names: [
    '中道'
  ],
  colors: [
    '青'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'C',
  imageUrl: '1754284680572616.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
