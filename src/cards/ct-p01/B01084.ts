// cards/ct-p01/B01084 降谷零 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   自分のターン終了時、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル5以上のカードが発見された場合、このキャラ以外のレベル6以下のキャラを1枚まで選び、アクティブにする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'souza',
        args: {
          player: 'opp',
          x: 1,
          bind: '$found'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundAnyMatchesFilter',
          bindKey: '$found',
          filter: {
            levelMin: 5
          }
        },
        then: {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            player: 'self',
            state: 'active',
            side: 'either',
            excludeSelf: true,
            filter: {
              kind: 'character',
              levelMax: 6
            },
            max: 1
          }
        }
      }
    ]
  },
  description: '自分のターン終了時、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル5以上のカードが発見された場合、このキャラ以外のレベル6以下のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B01084: CardDef = {
  id: 'B01084',
  no: '0072/B01084',
  kind: 'character',
  names: [
    '降谷零'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '公安'
  ],
  rarity: 'R',
  imageUrl: '1714013067526058.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
