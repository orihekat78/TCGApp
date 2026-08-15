// cards/ct-p06/B06011P 毛利蘭 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー青】【登場時】自分のデッキのカードを上からレベル7以上の〚カード名［工藤新一］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - 【パートナー青】 => ability.condition = { kind 'partnerColor', color:'青' } [src/engine/cond/eval.ts:37-43 case 'partnerColor' reads owner partner CardDef.colors and returns want.some(c=>have.includes(c)) — honored. Exemplar src/cards/ct-p06/B06007.ts a2 places the IDENTICAL condition:{kind 'partnerColor',color:'青'} on a 【パートナー青】【登場時】 character with the same trigger shape.]
//   - 【登場時】 => type 'triggered', scope 'on-scene', trigger {hook 'enter', selfOnly:true} [src/engine/types/hooks.ts:39 'enter' hook registered (【登場時】). Exemplars src/cards/ct-p05/B05017.ts a1 and src/cards/ct-p06/B06007.ts a2 both use {type 'triggered',scope 'on-scene',trigger {hook 'enter',selfOnly:true}} for 【登場時】 on a character; selfOnly:true scopes the trigger to the entering card (BUG-146 source unified to entering char).]
//   - 自分のデッキのカードを上からレベル7以上の〚カード名［工藤新一］〛が出るまで1枚ずつ公開し => atom deckRevealUntil { player:'self', filter:{ levelMin:7, cardName:'工藤新一' }, bind:'$revealed', bindMatch:'$matched' } (no maxN) [src/engine/effect/atom-handlers.ts:1336 case 'deckRevealUntil'; maxN-UNSET branch (l.1410-1418) does `for(const cardId of deck){ revealed.push(cardId); if(filter(cardId)){matched=cardId;break} }` = exactly '出るまで1枚ずつ公開'. filter via targetFilterToPredicate (l.65-109): levelMin honored l.89 ((d.level??0)<filter.levelMin => false, so level>=7 passes = 'レベル7以上'); cardName honored l.102-106 via allCardNameComponentsForDef (card-def-registry.ts:69-79, rules/19 split-name aware) — this is LIVE code (wave#2 cluster2 2026-06-12) that overrides cap-map line 67/113 'cardName NOT honored' STALE claim. Both fields ANDed (any mismatch returns false) so match requires level>=7 AND name=工藤新一. $matched=match-or-[], $revealed=revealed (slice(0,-1) in no-maxN path, excludes match). No maxN => no chooseMatch => forced first-match auto-take (no pick surfaced). Exemplar B05017.ts a1 = identical no-maxN deckRevealUntil with bind/bindMatch.]
//   - それを手札に加える => conditional{ if:bound $matched matched, then: atom handAddFromDeck { player:'self', cardId:'$matched.cardId' } } [src/engine/cond/eval.ts:168-175 case 'bound' presence:'matched' => bound.length>0. src/engine/effect/atom-handlers.ts:557-578 handAddFromDeck resolveBindRef('$matched.cardId') => deck.indexOf => splice => mutate.hand.add (matched card leaves deck to hand, not duplicated). Mandatory add (text '加える', no 「まで」) = forced. No-match edge: $matched=[] => conditional skips (deck fully revealed, nothing added) per rules/15 可能な限り. Exemplar B05017.ts a1 / B06010.ts a1 use the identical conditional+handAddFromDeck '$matched.cardId' shape.]
//   - 残りの公開したカードをデッキの下に移し => atom deckToBottomBound { player:'self', bindKey:'$revealed' } [src/engine/effect/atom-handlers.ts:1507-1536 case 'deckToBottomBound' splices each $revealed cardId out of deck then mutate.deck.toBottom (splice-guard against duplicates). $revealed already excludes the matched card (set in deckRevealUntil no-maxN restIds=revealed.slice(0,-1)). Exemplar B05017.ts a1 / B06010.ts a1 deckToBottomBound{bindKey:'$revealed'}.]
//   - デッキをシャッフルする => atom deckShuffle { player:'self' } [src/engine/effect/atom-handlers.ts (case 'deckShuffle') mutate.deck.shuffle(s,p,ctx.rng). Exemplar B05017.ts a1 / B06010.ts a1 final step deckShuffle{player:'self'} for identical '残りをデッキ下に移し、デッキをシャッフルする' wording.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    kind: 'partnerColor',
    color: '青'
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
            levelMin: 7,
            cardName: '工藤新一'
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
  description: '【パートナー青】【登場時】自分のデッキのカードを上からレベル7以上の〚カード名［工藤新一］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06011P: CardDef = {
  id: 'B06011P',
  no: '0636/B06011P',
  kind: 'character',
  names: [
    '毛利蘭'
  ],
  colors: [
    '青'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [
    '高校生',
    '毛利探偵事務所',
    '空手家'
  ],
  rarity: 'CP',
  imageUrl: '1755684931847116.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
