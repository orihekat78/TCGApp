// cards/ct-p04/B04027 「後ろの女に一言遺したろ思てなァ…」 (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   このイベントは自分のFILEエリアにあるカードが5枚以下の場合に使用できる。\n【パートナー緑】【解決編】AP7000以上のキャラを1枚までと、AP5000以下のキャラを1枚まで選び、リムーブする。

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
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '緑'
      },
      {
        kind: 'caseStatus',
        status: '解決編'
      }
    ]
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect',
          filter: {
            apMin: 7000
          }
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
            apMax: 5000
          }
        }
      }
    ]
  },
  description: 'このイベントは自分のFILEエリアにあるカードが5枚以下の場合に使用できる。【パートナー緑】【解決編】AP7000以上のキャラを1枚までと、AP5000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B04027: CardDef = {
  id: 'B04027',
  no: '0427/B04027',
  kind: 'event',
  names: [
    '「後ろの女に一言遺したろ思てなァ…」'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287737427806.jpg',
  useCondition: { kind: 'not', c: { kind: 'fileAtLeast', n: 6 } },
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
