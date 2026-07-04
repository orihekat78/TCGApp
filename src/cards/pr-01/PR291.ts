// cards/pr-01/PR291 紫紅の爪 (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/01-victory-conditions.md
// 公式テキスト:
//   【パートナー白】【解決編】AP7000以上のキャラを1枚まで選び、リムーブする。このカードをパートナーエリアに移す。自分の現場に〚カード名［怪盗キッド］〛がいる場合、手札からレベル3以下の【白】のキャラを1枚までスリープ状態で登場させてもよい。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードをパートナーエリアに移す。

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
        color: '白'
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
          filter: {
            apMin: 7000
          }
        }
      },
      {
        kind: 'atom',
        verb: 'toPartnerArea',
        args: {}
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bond',
          cardName: '怪盗キッド'
        },
        then: {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$pick.cardId',
            from: 'hand',
            viaEffect: true,
            enterSleep: true,
            bind: '$matched',
            target: {
              kind: 'pick',
              query: {
                area: 'hand',
                side: 'self',
                filter: {
                  color: '白',
                  levelMax: 3,
                  kind: 'character'
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
      }
    ]
  },
  description: '【パートナー白】【解決編】AP7000以上のキャラを1枚まで選び、リムーブする。このカードをパートナーエリアに移す。自分の現場に〚カード名［怪盗キッド］〛がいる場合、手札からレベル3以下の【白】のキャラを1枚までスリープ状態で登場させてもよい。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
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
    args: {},
    kind: 'atom',
    verb: 'toPartnerArea'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードをパートナーエリアに移す。',
  ruleRefs: [
    'rules/10-action-event.md'
  ]
};

export const PR291: CardDef = {
  id: 'PR291',
  no: '1062/PR291',
  kind: 'event',
  names: [
    '紫紅の爪'
  ],
  colors: [
    '白'
  ],
  level: 5,
  traits: [],
  rarity: 'PR',
  imageUrl: '1779885194416137.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/01-victory-conditions.md'
  ],
};
