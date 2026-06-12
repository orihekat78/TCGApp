// cards/ct-p05/B05017 円谷朝美 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から【青】のイベントが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}, type:'triggered', scope:'on-scene' [hook 'enter' selfOnly=source.uid (capability-map hooks §enter; brief 【登場時】X pattern). Exemplar src/cards/ct-p01/B01013.ts a1 = identical {type:'triggered',scope:'on-scene',trigger:{hook:'enter',selfOnly:true}} on a 【登場時】 character.]
//   - 自分のデッキのカードを上から【青】のイベントが出るまで1枚ずつ公開し => atom deckRevealUntil {player:'self', filter:{color:'青',kind:'event'}, bind:'$revealed', bindMatch:'$matched'} (no maxN) [src/engine/effect/atom-handlers.ts:1037-1119 — maxN UNSET branch reveals deck top one-by-one via `for (const cardId of deck){ revealed.push; if(filter(cardId)) {matched=cardId; break} }` = exactly '出るまで1枚ずつ公開'. filter via targetFilterToPredicate (lines 57-87) ANDs color (d.colors.includes '青', l.66-69) AND kind (d.kind==='event', l.84, BUG-118). $matched=match-or-[], $revealed=revealed.slice(0,-1). Exemplar D11019.ts a1 uses the same no-maxN deckRevealUntil for '出るまで1枚ずつ公開'; B01013.ts a1 uses color+kind filter on this path.]
//   - それを手札に加える => conditional(if bound $matched matched) → atom handAddFromDeck {player:'self', cardId:'$matched.cardId'} [src/engine/effect/atom-handlers.ts:403-423 — resolves $matched.cardId, splices it out of deck and `mutate.hand.add` (so the matched event leaves deck → hand, not duplicated). Exemplar B01013.ts a1 / D01013.ts a1 use the identical `conditional{if:bound $matched matched} → handAddFromDeck{cardId:'$matched.cardId'}` shape. Mandatory add (text '加える'); when no event found $matched=[] → conditional skips (deck fully revealed, nothing added) which is correct.]
//   - 残りの公開したカードをデッキの下に移し => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [src/engine/effect/atom-handlers.ts:1120-1139 — splices each $revealed cardId out of deck then `mutate.deck.toBottom`. $revealed already excludes the matched card. Exemplar B01013.ts a1 / D11019.ts a1 use identical deckToBottomBound{bindKey:'$revealed'}.]
//   - デッキをシャッフルする => atom deckShuffle {player:'self'} [src/engine/effect/atom-handlers.ts:1141-1148 — `mutate.deck.shuffle(s,p,ctx.rng)`. Exemplar D11019.ts a1 final step is the identical deckShuffle{player:'self'} appended after the same reveal/toBottom sequence (D11019 is the same '出るまで…デッキの下に移し、デッキをシャッフルする' family).]

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: {
            color: '青',
            kind: 'event'
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
  description: '【登場時】自分のデッキのカードを上から【青】のイベントが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B05017: CardDef = {
  id: 'B05017',
  no: '0523/B05017',
  kind: 'character',
  names: [
    '円谷朝美'
  ],
  colors: [
    '青'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628061732942.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
