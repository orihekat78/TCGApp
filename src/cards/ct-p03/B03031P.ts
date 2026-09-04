// cards/ct-p03/B03031P 大岡紅葉 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー緑】【登場時】自分のデッキのカードを上からレベル8以上の〚カード名［服部平次］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。カードを手札に加えた場合、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［服部平次］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【パートナー緑】 (ability condition gate) => AbilityDef.condition { kind 'partnerColor', color:'緑' } [src/cards/ct-d01/D01004.ts a1 uses condition:{kind 'partnerColor',color:'青'} alongside trigger {hook 'enter'}. partnerColor is a live condition (capability-map cond/eval.ts; brief 条件アイコン = ability.condition). Same shape, color swapped to 緑.]
//   - 【登場時】 (trigger) => trigger { hook 'enter', selfOnly:true }, type 'triggered', scope 'on-scene' [src/cards/ct-p05/B05017.ts a1 & ct-p01/B01013.ts a1 use identical {type 'triggered',scope 'on-scene',trigger {hook 'enter',selfOnly:true}} on 【登場時】 characters. Hooks list 'enter' (【登場時】).]
//   - 自分のデッキのカードを上からレベル8以上の〚カード名［服部平次］〛が出るまで1枚ずつ公開し => atom deckRevealUntil { player:'self', filter:{cardName:'服部平次', levelMin:8}, bind:'$revealed', bindMatch:'$matched' } (no maxN, no chooseMatch = forced reveal-until) [atom-handlers.ts:1411-1421 no-maxN branch reveals deck top one-by-one (`for (const cardId of deck){revealed.push; if(filter(cardId)){matched=cardId;break}}`) = '出るまで1枚ずつ公開'. filter via targetFilterToPredicate (l.65-110): levelMin honored (l.90 `filter.levelMin`), AND cardName honored (l.101-105 via allCardNameComponentsForDef) — BOTH ANDed per card (brief STALE-warning that cardName is dropped is FALSE in live code; comment l.93-94 'wave#2 cluster2 cardName が silent drop されていた' = since-fixed). card-def-registry.ts:70 allCardNameComponentsForDef adds each names[] literal so a 服部平次 card with names:['服部平次'] matches. Exemplar src/cards/ct-p05/B05017.ts a1 uses the identical no-maxN deckRevealUntil for '出るまで1枚ずつ公開'.]
//   - それを手札に加える (mandatory add of matched card) => conditional(if bound $matched matched) → atom handAddFromDeck { player:'self', cardId:'$matched.cardId' } [atom-handlers.ts handAddFromDeck splices $matched.cardId out of deck → hand. Exemplars B05017.ts a1 / B01013.ts a1 / D01013.ts a1 all use conditional{if:bound $matched matched}→handAddFromDeck{cardId:'$matched.cardId'}. No 'まで', so mandatory add; when no match $matched=[] → conditional skips (deck fully revealed).]
//   - 残りの公開したカードをデッキの下に移し => atom deckToBottomBound { player:'self', bindKey:'$revealed' } [atom-handlers.ts:1510-1537 splices each $revealed cardId out of deck then mutate.deck.toBottom. $revealed = revealed.slice(0,-1) (excludes matched; atom-handlers.ts:1474). Exemplars B05017.ts a1 / B01013.ts a1 use identical deckToBottomBound{bindKey:'$revealed'}.]
//   - デッキをシャッフルする => atom deckShuffle { player:'self' } [atom-handlers.ts deckShuffle calls mutate.deck.shuffle(ctx.rng). Exemplar B05017.ts a1 final step is the identical deckShuffle{player:'self'} appended after the same reveal/toBottom sequence (same '出るまで…デッキの下に移し、デッキをシャッフルする' family).]
//   - カードを手札に加えた場合、手札を1枚リムーブする => discard {player:'self', n:1} nested inside the same conditional($matched matched) sequence after handAddFromDeck [src/cards/ct-d01/D01013.ts a1 has the identical tail: conditional(if $matched matched)→sequence[handAddFromDeck, discard{n:1}] for its '手札に加えた場合、手札を1枚リムーブする' clause. discard n:1 = mandatory (not 'max'); since the matched card was just added to hand, hand always has ≥1 so the forced discard is satisfiable.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => a2 trigger { hook 'evidence:remove-by-action', optional:true }, type 'triggered', scope 'on-evidence' [Hooks list evidence:remove-by-action (【現場リムーブ時】 of evidence by action = ヒラメキ). Exemplars D01013.ts a2 / D01012.ts a2 / B03059.ts a2 all use {hook 'evidence:remove-by-action', optional:true}, scope 'on-evidence' for 【ヒラメキ】.]
//   - 自分のリムーブエリアにある〚カード名［服部平次］〛を1枚まで選び、手札に加える => atom handAddFromRemove { player:'self', max:1, filter:{cardName:'服部平次'} } [EXACT twin: src/cards/ct-p03/B03059.ts a2 (same set, identical hirameki text) = handAddFromRemove{player:'self', max:1, filter:{cardName:'怪盗キッド'}}. atom-handlers.ts:617-619 short-form builds buildShortFormPick(area='remove') passing filter (atom-pick-spec.ts: `if(a.filter) query.filter=a.filter`). Remove-area candidates route through candidates.ts case 'remove'→matchOneFilter, which honors cardName (l.261-265 via allCardNameComponentsForDef). max:1 ⇒ n.min:0 (1枚まで = 0枚可, rules/15). Family: B03012/B02009/D11012 a2 same pattern.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '緑'
  },
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
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filter: {
            cardName: '服部平次',
            levelMin: 8
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
          bindKey: '$revealed',
          order: 'preserve'
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
  description: '【パートナー緑】【登場時】自分のデッキのカードを上からレベル8以上の〚カード名［服部平次］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
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
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        cardName: '服部平次'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［服部平次］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md'
  ]
};

export const B03031P: CardDef = {
  id: 'B03031P',
  no: '0288/B03031P',
  kind: 'character',
  names: [
    '大岡紅葉'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'RP',
  imageUrl: '1729133249283324.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
