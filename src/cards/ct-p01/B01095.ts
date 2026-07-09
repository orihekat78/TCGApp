// cards/ct-p01/B01095 「僕の日本から…」 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【パートナー黄】カード名を1つ指定し、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。指定したカード名のカードが発見された場合、キャラを2枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）

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
    color: '黄'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'declareName',
        args: {
          bind: 'named'
        }
      },
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
          kind: 'boundNameMatchesDeclared',
          bindKey: '$found',
          declareKey: 'named'
        },
        then: {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            player: 'self',
            state: 'stun',
            side: 'either',
            max: 2
          }
        }
      }
    ]
  },
  description: '【パートナー黄】カード名を1つ指定し、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。指定したカード名のカードが発見された場合、キャラを2枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B01095: CardDef = {
  id: 'B01095',
  no: '0083/B01095',
  kind: 'event',
  names: [
    '「僕の日本から…」'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1714013082055674.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md'
  ],
};
