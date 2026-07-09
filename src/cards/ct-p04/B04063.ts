// cards/ct-p04/B04063 「諦めるなよ瑛海!!」 (event) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー赤】自分のデッキのカードを上から3枚見る。その中からカードを1枚まで手札に加え、残りをリムーブエリアに移す。リムーブエリアに移したカードのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブする。

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
  condition: {
    kind: 'partnerColor',
    color: '赤'
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
            cardId: '$matched.cardId'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'boundToRemove',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      },
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect',
          filter: {
            levelMax: {
              dyn: '$bound.$revealed.levelSum'
            }
          }
        }
      }
    ]
  },
  description: '【パートナー赤】自分のデッキのカードを上から3枚見る。その中からカードを1枚まで手札に加え、残りをリムーブエリアに移す。リムーブエリアに移したカードのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B04063: CardDef = {
  id: 'B04063',
  no: '0452/B04063',
  kind: 'event',
  names: [
    '「諦めるなよ瑛海!!」'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287801275142.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
