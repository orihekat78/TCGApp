// cards/ct-p06/B06104 カッ (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/12-next-hint.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【パートナー黒】【解決編】すべてのキャラをリムーブする。自分のFILEエリアにあるカードを上から2枚手札に加え、手札からレベル7以下の【黒】のキャラを1枚まで登場させる。このターン中、自分はネクストヒントできない。
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
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '黒'
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
        kind: 'forEach',
        over: {
          kind: 'all',
          query: {
            area: 'scene',
            side: 'either'
          }
        },
        do: {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$each.uid',
            cause: 'effect'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'filePopToHand',
        args: {
          player: 'self'
        }
      },
      {
        kind: 'atom',
        verb: 'filePopToHand',
        args: {
          player: 'self'
        }
      },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'hand',
          max: 1,
          viaEffect: true,
          filter: {
            color: '黒',
            levelMax: 7,
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'setNextHintBan',
        args: {
          player: 'self'
        }
      }
    ]
  },
  description: '【パートナー黒】【解決編】すべてのキャラをリムーブする。自分のFILEエリアにあるカードを上から2枚手札に加え、手札からレベル7以下の【黒】のキャラを1枚まで登場させる。このターン中、自分はネクストヒントできない。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
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

export const B06104: CardDef = {
  id: 'B06104',
  no: '0721/B06104',
  kind: 'event',
  names: [
    'カッ'
  ],
  colors: [
    '黒'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285264394799.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
