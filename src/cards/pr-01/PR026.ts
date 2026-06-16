// cards/pr-01/PR026 毛利蘭 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚見る。その中から〚カード名［妃英理］〛か〚カード名［工藤新一］〛か〚特徴［毛利探偵事務所］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
// 句マッピング:
//   - 【登場時】 => trigger {hook 'enter', selfOnly:true}, type 'triggered', scope 'on-scene' [src/cards/ct-p01/B01013.ts a1 and src/cards/pr-01/PR104.ts a1 use identical {hook 'enter',selfOnly:true} for 【登場時】; src/cards/ct-p04/B04005.ts:18 confirms same shape in same pack. 'enter' is a registered card-triggerable hook (capability-map §Hooks).]
//   - 自分のデッキのカードを上から1枚見る => atom deckRevealUntil {player:'self', maxN:1, chooseMatch:'upTo', bind:'$revealed', bindMatch:'$matched'} [src/cards/ct-p05/B05020.ts a1 is byte-near-identical 「上から1枚見る…1枚まで公開して手札に加え…残りデッキ下」 with maxN:1 + chooseMatch:'upTo'. Engine atom-handlers.ts deckRevealUntil (read): maxN set => reveals min(deck,maxN)=min(deck,1) then first filter match; binds remainder->$revealed, match->$matched.]
//   - その中から〚カード名［妃英理］〛か〚カード名［工藤新一］〛か〚特徴［毛利探偵事務所］〛のキャラ => deckRevealUntil filter:{kind 'character'} + filterAny:[{cardName:'妃英理'},{cardName:'工藤新一'},{trait:'毛利探偵事務所'}] (= AND-of(kind character, OR(cardName 妃英理, cardName 工藤新一, trait 毛利探偵事務所))) [cluster16 G2: atom-handlers.ts deckRevealUntil now honors filterAny on the reveal-filter path (read ~lines 1350-1360): filter=(id)=>basePred(id) && anyPreds.some(p=>p(id)) — exactly AND-of(filter, OR(filterAny)). targetFilterToPredicate (atom-handlers.ts:66-113, read) honors cardName (via allCardNameComponentsForDef, split-name rules/19), trait, and kind on deck cards. 'のキャラ'=>kind 'character' base AND (brief §cluster16 G2). Literals 妃英理/工藤新一/毛利探偵事務所 confirmed registered in src/cards (B01013 names, D01004 names, D01003 traits). cardName 妃英理 OR 工藤新一 same-field; trait 毛利探偵事務所 cross-field => filterAny required (brief: filterAny needed exactly for cross-field cardName/trait OR). Was the pre-cluster16 yellow blocker; now solved.]
//   - を1枚まで公開して手札に加え => chooseMatch:'upTo' (0枚可 decline) + conditional if bound $matched presence:'matched' then atom handAddFromDeck {cardId:'$matched.cardId'} [chooseMatch:'upTo' with maxN!==undefined surfaces a decline-able pick (nMin:0,nMax:1) for human owner (atom-handlers.ts:1438-1485, read; rules/15 「〜枚まで」=0枚可 + B08020 Q&A 加えないことは可能). handAddFromDeck splices $matched.cardId deck->hand. Exact triple (deckRevealUntil chooseMatch:'upTo' + conditional $matched + handAddFromDeck) copied from src/cards/ct-p05/B05020.ts a1 and src/cards/ct-p01/B01013.ts a1.]
//   - 残りを好きな順番でデッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [src/cards/ct-p05/B05020.ts a1 / src/cards/ct-p01/B01013.ts a1 final step. atom-handlers.ts deckToBottomBound moves bound cardIds deck->bottom (mutate.deck.toBottom). 「好きな順番」 player reorder is the accepted non-surfaced limitation uniform across ALL deck-look cards (preserves peek order; no engine change, no green impact).]

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
          chooseMatch: 'upTo',
          player: 'self',
          filter: {
            kind: 'character'
          },
          filterAny: [
            {
              cardName: '妃英理'
            },
            {
              cardName: '工藤新一'
            },
            {
              trait: '毛利探偵事務所'
            }
          ],
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
  description: '【登場時】自分のデッキのカードを上から1枚見る。その中から〚カード名［妃英理］〛か〚カード名［工藤新一］〛か〚特徴［毛利探偵事務所］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const PR026: CardDef = {
  id: 'PR026',
  no: '0253/PR026',
  kind: 'character',
  names: [
    '毛利蘭'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: [
    '高校生',
    '毛利探偵事務所',
    '空手家'
  ],
  rarity: 'PR',
  imageUrl: '1721703853374153.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
