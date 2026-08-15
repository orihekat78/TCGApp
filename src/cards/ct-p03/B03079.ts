// cards/ct-p03/B03079 レイチェル・浅香 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。その中から【赤】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【相手ターン中】 => a1.condition {kind 'turn', player:'opp'} [src/engine/cond/eval.ts:35-36 case 'turn': returns state.turn.player === resolvePlayer(cond.player,ctx). eval.ts:373 registers turn:true. Exemplar D05007.ts a1 uses identical condition for word-for-word same trigger text.]
//   - 【現場リムーブ時】(このキャラ自身) => a1.trigger {hook 'leave:to-remove', selfOnly:true}, scope 'on-scene' [src/engine/types/hooks.ts:41 'leave:to-remove' registered. src/engine/listeners/triggered.ts:57 TRIGGERED_HOOKS includes 'leave:to-remove' (line 69); special leave handler lines 480-530 evaluates trig.selfOnly via selfOnlyMatches (line 499) and ability.condition via evalCond (line 513). Exemplar D05007.ts a1 identical.]
//   - 自分のデッキのカードを上から3枚見る => a1.deckRevealUntil {player:'self', maxN:3, bind:'$revealed', bindMatch:'$matched'} [src/engine/effect/validate.ts:36 deckRevealUntil registered in ATOM_VERB_MAP. atom-handlers.ts:1336 case 'deckRevealUntil': maxN reveals min(deck,maxN). Exemplar D05007.ts a1 (maxN:3) + D01012.ts a1 (maxN:3) identical.]
//   - その中から【赤】のカードを1枚まで公開して手札に加え => a1.deckRevealUntil {chooseMatch:'upTo', filter:{color:'赤'}} → conditional(bound $matched, presence:'matched') → handAddFromDeck {cardId:'$matched.cardId'} [color-only filter: atom-handlers.ts targetFilterToPredicate lines 74-77 honors filter.color via d.colors.includes(w) — matches ANY card kind (char OR event) = 「【赤】のカード」. No kind restriction in text. Exemplar D01013.ts a1 uses filter:{color:'青'} (color-only, no kind) for 「【青】のカードを1枚まで公開して手札に加え」. chooseMatch:'upTo': atom-handlers.ts:1418-1465 — owner=human surfaces pick nMin:0/nMax:1 (「まで」=0枚 decline 可, rules/15 + B08020 Q&A); AI auto-takes first match. handAddFromDeck: atom-handlers.ts:557-577 splices $matched.cardId from deck to hand. Exemplar B01013.ts a1 (chooseMatch:'upTo' + handAddFromDeck) identical.]
//   - 残りを好きな順番でデッキの下に移す => a1.deckToBottomBound {player:'self', bindKey:'$revealed'} [the atom moves only residual bound occurrences. With at least two residuals, the human owner receives pendingDeckReorder and its validated permutation becomes the bottom block.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => a2.trigger {hook 'evidence:remove-by-action', optional:true}, type 'triggered', scope 'on-evidence' [src/engine/types/hooks.ts:67 'evidence:remove-by-action' registered. src/engine/listeners/hirameki.ts:41-42,79-80 — hook + trigger.optional:true routes to __pendingHirameki side-channel (fire/skip). Exemplar D05007.ts a2 BYTE-IDENTICAL (same card text).]
//   - キャラを1枚まで選び、スリープさせる => a2.sceneSetState {uid:'$pick', state:'sleep', target:{kind 'pick', query:{area:'scene', side:'either'}, n:{min:0,max:1}, chooser:'self'}} [atom-handlers.ts:965-979 case 'sceneSetState' Pattern A short-form pick (uid:'$pick' + state + n/max → paShortFormAwait scene pick). n.min:0 ⇒ 「1枚まで」(0-pick legal, rules/15); side:'either' = どちらの現場も対象 (rules/15). validate.ts:26 sceneSetState registered. Exemplar D05007.ts a2 BYTE-IDENTICAL.]

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
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: {
            color: '赤'
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
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            presentation: 'public-selected-card'
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
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。その中から【赤】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/03-field-areas.md',
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
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const B03079: CardDef = {
  id: 'B03079',
  no: '0333/B03079',
  kind: 'character',
  names: [
    'レイチェル・浅香'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    'ボディガード'
  ],
  rarity: 'C',
  imageUrl: '1729133424894836.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
