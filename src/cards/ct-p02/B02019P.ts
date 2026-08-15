// cards/ct-p02/B02019P 伊織無我 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/24-qa-naming-stun.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から5枚見る。その中から【緑】のイベントを1枚まで公開して手札に加え、残りをシャッフルしてデッキの下に移す。\n自分のターン終了時、カードがセットされているキャラを1枚まで選び、アクティブにする。
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook 'enter', selfOnly:true}, scope 'on-scene' [src/cards/ct-p03/B03018.ts a1 + src/cards/ct-p08/B08020.ts a1 + src/cards/ct-p01/B01013.ts a1 all use trigger {hook 'enter',selfOnly:true} for 【登場時】. capability-map hooks: 'enter' card-triggerable, selfOnly matches source.uid=登場キャラ (BUG-146 emit source 統一).]
//   - 自分のデッキのカードを上から5枚見る。その中から【緑】のイベントを1枚まで公開して手札に加え => deckRevealUntil{chooseMatch:'upTo', maxN:5, filter:{color:'緑',kind 'event'}, bind:'$revealed', bindMatch:'$matched'} → conditional(bound $matched matched){then handAddFromDeck{cardId:'$matched.cardId'}} [src/cards/ct-p03/B03018.ts a1 = CHAR-FOR-CHAR identical clause ('上から5枚見る…イベントを1枚まで公開して手札に加え') with maxN:5,filter:{kind 'event'},chooseMatch:'upTo'. 緑 color added to filter — color honored in deckRevealUntil predicate per src/cards/ct-p08/B08020.ts a1 (filter:{color:'緑',kind 'event'}, certified green) and engine targetFilterToPredicate (atom-handlers L83 kind, candidates.ts color). 「1枚まで」=0枚可 → chooseMatch:'upTo' (BUG-132 GAP-1 decline channel, atom-handlers.ts L39-43). handAddFromDeck '$matched.cardId' wired per B01013/B08024.]
//   - 残りをシャッフルしてデッキの下に移す => deckToBottomBound{bindKey:'$revealed'} → deckShuffle{player:'self'} [src/cards/ct-p03/B03018.ts a1 = EXACT same clause '残りをシャッフルしてデッキの下に移す' encoded as deckToBottomBound then deckShuffle. atom-handlers.ts:1508-1534 deckToBottomBound splices bound (non-matched) revealed ids out of deck → mutate.deck.toBottom (order='given'); deckShuffle = mutate.deck.shuffle (atom-handlers.ts:1505-ish, validate.ts:36). 「シャッフルして…デッキの下」 = bottom then whole-deck shuffle randomizes hidden order = established codebase convention (D11019/B03018).]
//   - 自分のターン終了時 => a2 trigger {hook 'phase:end:start'} + condition {kind 'turn', player:'self'} [src/cards/ct-p04/B04080.ts a1 + src/cards/ct-p09/B09049.ts a1 + src/cards/ct-p08/B08015.ts a1 + src/cards/ct-d03/D03011.ts a1 all use trigger {hook 'phase:end:start'},condition:{kind 'turn',player:'self'} for 自分のターン終了時. phase:end:start emitted (flow/turn.ts:60 payload {player:p}) + registered TRIGGERED_HOOKS (triggered.ts:65). source undefined → gate by condition turn:self, NOT selfOnly (capability-map hooks).]
//   - カードがセットされているキャラを1枚まで選び、アクティブにする => choice(chooser:self){ sceneSetState{uid:'$pick', state:'active', target:{kind 'pick', query:{area:'scene', side:'either', filter:{hasSetCards:true}}, n:{min:0,max:1}, chooser:'self'}} } [src/cards/ct-p04/B04080.ts a1 = template for 'ターン終了時…キャラを1枚まで選び、アクティブにする' (choice + sceneSetState state:'active' + pick query side/filter, n:{min:0,max:1}). filter:{hasSetCards:true} honored on scene char enumeration: src/engine/target/candidates.ts:323-325 (has = c.setCards.length>0); exemplar src/cards/ct-p08/B08024.ts a2 uses filter:{hasSetCards:true} with side:'either'. side:'either' per rules/15 (エリア指定なし「キャラ」= どちらの現場でも選べる). 「1枚まで」=0枚可 → n.min:0 (rules/15). スタン代替スリープ = engine 既定 (rules/03/24).]

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
            color: '緑',
            kind: 'event'
          },
          maxN: 5,
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
          order: 'shuffle'
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から5枚見る。その中から【緑】のイベントを1枚まで公開して手札に加え、残りをシャッフルしてデッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$pick',
          state: 'active',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'either',
              filter: {
                hasSetCards: true
              }
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      }
    ]
  },
  description: '自分のターン終了時、カードがセットされているキャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B02019P: CardDef = {
  id: 'B02019P',
  no: '0189/B02019P',
  kind: 'character',
  names: [
    '伊織無我'
  ],
  colors: [
    '緑'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '執事'
  ],
  rarity: 'SRP',
  imageUrl: '1721357188622408.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
