// cards/ct-p09/B09062 ジョディ・スターリング (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚見る。その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。\n【宣言】〚手札を1枚リムーブする〛：ターン終了時までこのキャラは〚突撃〛（名乗り状態でもアクションできる）を持つ。
// 句マッピング:
//   - 【登場時】 => type:'triggered', scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [B01013.ts a1 — identical 【登場時】 trigger shape; capability-map hook list: enter (selfOnly ok)]
//   - 自分のデッキのカードを上から1枚見る => atom deckRevealUntil {player:'self', maxN:1, bind:'$revealed', bindMatch:'$matched'} [B01013.ts a1 uses deckRevealUntil maxN:2; same verb args, maxN set to 1 here; capability-map verb 'deckRevealUntil' (reveals min(deck,maxN))]
//   - その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え => filter:{trait:'FBI', kind:'character'} on deckRevealUntil + conditional bound '$matched' matched -> handAddFromDeck {cardId:'$matched.cardId'} [B01013.ts a1 (filter {color,lpMax,kind} + conditional bound matched -> handAddFromDeck); src/engine/effect/atom-handlers.ts targetFilterToPredicate L69-72 honors trait, L83 honors kind on deckRevealUntil predicate path (BUG-117/118 fixed). '1枚まで' = single matched card surfaced (0 ok via conditional)]
//   - 残りを好きな順番でデッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [B01013.ts a1 final step deckToBottomBound bindKey:'$revealed'; capability-map verb 'deckToBottomBound' (moves bound cardIds deck->bottom)]
//   - 【宣言】 => type:'declared', scope:'on-scene' [D08005.ts a2 / D02013.ts a1 / B09049.ts a2 — declared ability on scene char; capability-map AbilityType 'declared' uses cost+effect]
//   - 〚手札を1枚リムーブする〛（コスト） => cost:{kind:'removeFromHand', target:{kind:'pick',query:{area:'hand',side:'self'},n:{min:1,max:1},chooser:'self'}, n:1} [D02013.ts a1 cost removeFromHand (exact shape) + B09049.ts a2 cost removeFromHand; capability-map Cost 'removeFromHand {target,n}' payable if candidates>=n; rules/21 cost target is always self-side]
//   - ターン終了時までこのキャラは〚突撃〛を持つ => effect: atom charGrantKeyword {uid:'$self', kw:'突撃', scope:'turn'} [D08005.ts a2 — IDENTICAL effect charGrantKeyword {uid:'$self', kw:'突撃', scope:'turn'} (also 灰原 grants 突撃 until turn end via declared); capability-map verb 'charGrantKeyword {uid,kw,scope}']

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
            trait: 'FBI',
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
  description: '【登場時】自分のデッキのカードを上から1枚見る。その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'removeFromHand',
    target: {
      kind: 'pick',
      query: {
        area: 'hand',
        side: 'self'
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$self',
      kw: '突撃',
      scope: 'turn'
    }
  },
  description: '【宣言】〚手札を1枚リムーブする〛：ターン終了時までこのキャラは〚突撃〛（名乗り状態でもアクションできる）を持つ。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/13-keywords.md'
  ]
};

export const B09062: CardDef = {
  id: 'B09062',
  no: '1004/B09062',
  kind: 'character',
  names: [
    'ジョディ・スターリング'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'C',
  imageUrl: '1775608872841411.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
