// cards/ct-p03/B03056P 千間降代 (character, パラレル) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/11-reasoning.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
//
// B03056 のパラレル (テキスト・能力とも完全同一、rarity/imageUrl のみ差)。句マッピング・公式Q&A の扱いは B03056.ts 参照。

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
            trait: '探偵',
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
  description: '【登場時】デッキ上から1枚見る → 特徴[探偵]のキャラを1枚まで手札 → 残りをデッキ下。',
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
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'self'
      },
      {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            trait: '探偵'
          },
          state: ['sleep']
        },
        nMin: 3
      }
    ]
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$self',
            cause: 'effect'
          }
        },
        {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '自分のターン終了時、自分の現場に特徴[探偵]のスリープ状態のキャラが3枚以上いる場合、このキャラをリムーブしてもよい。そうした場合、証拠を1つ得る。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B03056P: CardDef = {
  id: 'B03056P',
  no: '0311/B03056P',
  kind: 'character',
  names: [
    '千間降代'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: [
    '探偵'
  ],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1729133406750288.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
