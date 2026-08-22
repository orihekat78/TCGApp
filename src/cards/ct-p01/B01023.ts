// cards/ct-p01/B01023 シャッフルロマンス (event) — Task A green候補 (engine変更0)
// rules: rules/08-contact.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/22-qa-action-contact.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   自分のデッキのカードを上から5枚見る。その中からカードを1枚まで手札に加え、残りを好きな順番でデッキの下に移す。このイベントを自分の現場にいるキャラ1枚にセットする。\nこのイベントがセットされているキャラは「このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋2000する。」を持つ。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
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
          bindKey: '$revealed'
        }
      },
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: {
          player: 'self',
          fromSelf: true,
          n: 1,
          filter: {
            kind: 'character'
          }
        }
      }
    ]
  },
  description: '自分のデッキのカードを上から5枚見る。その中からカードを1枚まで手札に加え、残りを好きな順番でデッキの下に移す。このイベントを自分の現場にいるキャラ1枚にセットする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-set-host',
  trigger: {
    hook: 'contact:start',
    matcherCondition: {
      kind: 'or',
      cs: [
        { kind: 'triggerCharMatches', payloadKey: 'aUid', requireSource: true },
        { kind: 'triggerCharMatches', payloadKey: 'bUid', requireSource: true }
      ]
    }
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$self',
      delta: 2000,
      scope: 'contact'
    }
  },
  description: 'このイベントがセットされているキャラは「このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋2000する。」を持つ。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/16-card-set.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B01023: CardDef = {
  id: 'B01023',
  no: '0019/B01023',
  kind: 'event',
  names: [
    'シャッフルロマンス'
  ],
  colors: [
    '青'
  ],
  level: 2,
  traits: [],
  rarity: 'C',
  imageUrl: '1714012985537235.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
