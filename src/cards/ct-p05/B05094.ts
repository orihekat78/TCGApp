// cards/ct-p05/B05094 甲斐玄人 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚特徴［長野県警］〛のキャラが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【相手ターン中】 => condition:{kind:'turn',player:'opp'} [cond/eval.ts:34-35 (state.turn.player===resolvePlayer(cond.player)); exemplar src/cards/ct-d01/D01012.ts a1 (same 【相手ターン中】 turn:opp condition)]
//   - 【現場リムーブ時】(このキャラ自身) => trigger:{hook:'leave:to-remove',selfOnly:true}, scope:'on-scene' [listeners/triggered.ts:66 (hook registered), :410 selfOnly via selfOnlyMatches, :408 hook==='leave:to-remove'; exemplar src/cards/ct-d01/D01012.ts a1 identical trigger]
//   - 自分のデッキのカードを上から〚特徴［長野県警］〛のキャラが出るまで1枚ずつ公開し => atom deckRevealUntil {player:'self',filter:{trait:'長野県警',kind:'character'},bind:'$revealed',bindMatch:'$matched'} (no maxN = unbounded reveal-until-match) [atom-handlers.ts:1037 case deckRevealUntil — no-maxN else branch (:1068-) reveals 1-by-1 until filter match or deck end; trait+kind honored in targetFilterToPredicate (:70-73 d.traits.includes, :86 d.kind===filter.kind). Exemplar src/cards/ct-d11/D11019.ts a1 uses unbounded deckRevealUntil (no maxN) with same bind/$matched shape]
//   - それを手札に加える => conditional(if $matched matched) then atom handAddFromDeck {player:'self',cardId:'$matched.cardId'} [atom-handlers.ts:403 case handAddFromDeck (splice bound cardId from deck → hand); exemplar src/cards/ct-p01/B01013.ts a1 (deckRevealUntil→conditional bound→handAddFromDeck $matched.cardId). bound/presence:matched conditional grounded by D01012.ts/B01013.ts]
//   - 残りの公開したカードをデッキの下に移し => atom deckToBottomBound {player:'self',bindKey:'$revealed'} [atom-handlers.ts:1120 case deckToBottomBound (splice bound ids from deck, mutate.deck.toBottom). $revealed bind = revealed.slice(0,-1) i.e. all-revealed-minus-matched (:1090-1092, unbounded branch). Exemplar D11019.ts a1 / D01012.ts a1 same step]
//   - デッキをシャッフルする => atom deckShuffle {player:'self'} [atom-handlers.ts:1141 case deckShuffle (mutate.deck.shuffle); exemplar src/cards/ct-d11/D11019.ts a1 final step {verb:'deckShuffle',args:{player:'self'}}]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => triggered scope:'on-evidence' trigger:{hook:'evidence:remove-by-action',optional:true} effect:atom draw {player:'self',n:1} [exemplar src/cards/ct-d08/D08013.ts a2 byte-identical (scope on-evidence, evidence:remove-by-action optional, draw n:1). hook listed in brief as ヒラメキ trigger; draw verb validate.ts:21 / atom-handlers draw]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'opp'
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
            trait: '長野県警',
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
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚特徴［長野県警］〛のキャラが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
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
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B05094: CardDef = {
  id: 'B05094',
  no: '0592/B05094',
  kind: 'character',
  names: [
    '甲斐玄人'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'C',
  imageUrl: '1745322226197264.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
