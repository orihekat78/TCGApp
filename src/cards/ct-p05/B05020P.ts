// cards/ct-p05/B05020P 吉田歩美 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から1枚見る。その中から〚カード名［江戸川コナン］〛か〚［灰原哀］〛か〚［小嶋元太］〛か〚［円谷光彦］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
// 句マッピング:
//   - 【相手ターン中】 => ability.condition {kind 'turn', player:'opp'} [Condition 'turn' fully evaluated in src/engine/cond/eval.ts (state.turn.player === resolvePlayer(cond.player)); capability-map §E lists 'turn'. Exemplar src/cards/ct-p05/B05094.ts a1 and src/cards/ct-d05/D05007.ts a1 use byte-identical condition for word-for-word identical 【相手ターン中】 text.]
//   - 【現場リムーブ時】(このキャラ自身) => trigger {hook 'leave:to-remove', selfOnly:true}, scope 'on-scene' [leave:to-remove is a registered card-triggerable hook (capability-map §B; emitted by src/engine/mutate/scene.ts) with selfOnly support (handleLeaveToRemoveSelf for the leaving card's own ability). Exemplars B05094.ts a1 / D05007.ts a1 use identical trigger for the same 【現場リムーブ時】 self text.]
//   - 自分のデッキのカードを上から1枚見る => atom deckRevealUntil {player:'self', maxN:1, bind:'$revealed', bindMatch:'$matched'} [deckRevealUntil verb (atom-handlers.ts case 'deckRevealUntil', line ~1336). maxN set => reveals min(deck,maxN)=min(deck,1) then first filter match. Exemplar ct-p08/B08020.ts a1 (maxN:4) and D05007.ts a1 (maxN:3) use identical bind/bindMatch shape; here maxN:1 for 「上から1枚」.]
//   - その中から〚[江戸川コナン]〛か〚[灰原哀]〛か〚[小嶋元太]〛か〚[円谷光彦]〛を1枚まで公開して手札に加え => deckRevealUntil filter {cardName:[4 names]} + chooseMatch:'upTo' → conditional bound $matched presence:'matched' → handAddFromDeck {cardId:'$matched.cardId'} [Live targetFilterToPredicate (atom-handlers.ts:101-105) NOW honors filter.cardName via allCardNameComponentsForDef (wave#2 cluster2 fix; cap-map line 67/113 stale — brief says trust live code). cardName array = OR membership + split-name (rules/19). All 4 names confirmed registered exactly in src/cards (grep). 「1枚まで」(0-OK decline) = chooseMatch:'upTo' (BUG-132 GAP-1 decline channel, requires maxN!==undefined at atom-handlers.ts:1423). After-decline rejoin = conditional if bound $matched matched → handAddFromDeck $matched.cardId. Exemplar B08020.ts a1 is the canonical 「N枚見る…1枚まで公開して手札に加え」 type (chooseMatch:'upTo' + bound $matched + handAddFromDeck $matched.cardId).]
//   - 残りを好きな順番でデッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [deckToBottomBound (atom-handlers.ts case 'deckToBottomBound') splices bound cardIds from deck → bottom (mutate.deck.toBottom). Exemplars B05094.ts a1 / D05007.ts a1 / B08020.ts a1 final step. No deckShuffle (text has no シャッフル, unlike B05094); D05007 confirms 「残りを好きな順番でデッキの下に移す」 = deckToBottomBound alone. Engine preserves peek order; 「好きな順番」 reorder not surfaced (cap-map §D souza note — same accepted limitation, no engine change).]
//   - 【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う） => triggered scope 'on-hand' trigger {hook 'effect:declared', optional:true, selfOnly:true} effect atom charModifyAP {uid:'$contact.byUid', delta:1000, scope 'contact'} [Cut-in encoded as triggered + scope 'on-hand' + effect:declared optional (capability-map ICON ABILITIES / §C; brief: cutinFixedAP 廃止 → inline atom, exemplar D02012.ts). Byte-identical to src/cards/ct-d02/D02012.ts a1 (delta:2000) — here delta:1000. $contact.byUid resolved via $contact dyn (cap-map §2 $contact.byUid = attacker uid; contact flow injects source.bindings). scope 'contact' = expires at contact end (rules/09). Color-unrestricted per rules/09.]

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
            cardName: [
              '江戸川コナン',
              '灰原哀',
              '小嶋元太',
              '円谷光彦'
            ]
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
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から1枚見る。その中から〚カード名［江戸川コナン］〛か〚［灰原哀］〛か〚［小嶋元太］〛か〚［円谷光彦］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
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
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$contact.byUid',
      delta: 1000,
      scope: 'contact'
    }
  },
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B05020P: CardDef = {
  id: 'B05020P',
  no: '0526/B05020P',
  kind: 'character',
  names: [
    '吉田歩美'
  ],
  colors: [
    '青'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '少年探偵団'
  ],
  rarity: 'CP',
  imageUrl: '1747231489443558.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
