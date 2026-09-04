// cards/ct-p03/B03018 比護隆佑 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から5枚見る。その中からイベントを1枚まで公開して手札に加え、残りをシャッフルしてデッキの下に移す。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】（トリガ部） => triggered hook 'leave:to-remove' + selfOnly:true + condition {kind:'turn',player:'opp'} [B04018.ts a2 — identical 【相手ターン中】【現場リムーブ時】 shell: trigger:{hook:'leave:to-remove',selfOnly:true}, condition:{kind:'turn',player:'opp'}. leave:to-remove confirmed card-triggerable + selfOnly honored via handleLeaveToRemoveSelf (capability-map §B hooks).]
//   - 自分のデッキのカードを上から5枚見る。その中からイベントを1枚まで公開して手札に加え => atom deckRevealUntil {maxN:5, filter:{kind:'event'}, bind:'$revealed', bindMatch:'$matched'} → conditional bound matched → handAddFromDeck {cardId:'$matched.cardId'} [B01013.ts a1 — exact 'look top N → reveal up to 1 (filter) to hand' pattern (maxN:2,filter:{color/lpMax/kind}, conditional bound matched → handAddFromDeck '$matched.cardId'). kind:'event' filter honored in deckRevealUntil predicate path per src/engine/effect/atom-handlers.ts targetFilterToPredicate L83 (BUG-118: if(filter.kind!==undefined && d.kind!==filter.kind) return false) and deckRevealUntil case L1055 maxN reveals min(deck,5) then first match.]
//   - 残りをシャッフルしてデッキの下に移す => atom deckToBottomBound {bindKey:'$revealed',order:'shuffle'}。公開した残りだけを無作為化し、未公開のデッキ本体はシャッフルしない。
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。 => triggered scope:'on-evidence' hook:'evidence:remove-by-action' optional:true → choice(chooser:self)[ sceneSetState {uid:'$pick',state:'sleep',target:{kind:'pick',query:{area:'scene',side:'either'},n:{min:0,max:1},chooser:'self'}} ] [D08019.ts a2 — official text CHARACTER-FOR-CHARACTER identical ('【ヒラメキ】キャラを1枚まで選び、スリープさせる。'). Same hirameki encoding (capability-map §B/§icon: hirameki = triggered + evidence:remove-by-action + optional:true). Explicit target ($pick + pick query) retained per D08019 comment so hiramekiResolve auto-picks at fire time.]

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
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から5枚見る。その中からイベントを1枚まで公開して手札に加え、残りをシャッフルしてデッキの下に移す。',
  ruleRefs: [
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
    kind: 'choice',
    chooser: 'self',
    options: [
      {
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
      }
    ]
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const B03018: CardDef = {
  id: 'B03018',
  no: '0276/B03018',
  kind: 'character',
  names: [
    '比護隆佑'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    'サッカー選手'
  ],
  rarity: 'C',
  imageUrl: '1729133201232109.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
