// cards/ct-p06/B06074 沖矢昴＆世良真純 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/09-cutin-disguise.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md, rules/25-qa-effects-resolution.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】カードを1枚引き、手札からレベル7以下の〚特徴［赤井家］〛のキャラを1枚まで登場させる。\n【宣言】【ターン1】〚FILEエリアにあるカードを上から2枚リムーブする〛：ターン終了時、自分のFILEエリアにあるカードが5枚以下の場合、デッキのカードを上から2枚、1枚ずつ裏向きのままFILEエリアの上に置く。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000

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
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
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
            levelMax: 7,
            trait: '赤井家',
            kind: 'character'
          }
        }
      }
    ]
  },
  description: '【登場時】カードを1枚引き、手札からレベル7以下の〚特徴［赤井家］〛のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'fileFrom',
    n: 2
  },
  effect: {
    kind: 'atom',
    verb: 'reserveEffect',
    args: {
      hook: 'phase:end:start',
      mode: 'turn-end',
      effect: {
        kind: 'conditional',
        if: {
          kind: 'not',
          c: {
            kind: 'fileAtLeast',
            n: 6
          }
        },
        then: {
          kind: 'atom',
          verb: 'fileAdd',
          args: {
            player: 'self',
            n: 2
          }
        }
      }
    }
  },
  description: '【宣言】【ターン1】〚FILEエリアにあるカードを上から2枚リムーブする〛：ターン終了時、自分のFILEエリアにあるカードが5枚以下の場合、デッキのカードを上から2枚、1枚ずつ裏向きのままFILEエリアの上に置く。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    args: {
      delta: 2000,
      scope: 'contact',
      uid: '$contact.byUid'
    },
    kind: 'atom',
    verb: 'charModifyAP'
  },
  description: '【カットイン】AP＋2000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B06074: CardDef = {
  id: 'B06074',
  no: '0694/B06074',
  kind: 'character',
  names: ['沖矢昴＆世良真純', '沖矢昴', '世良真純'], // rules/19 複数名カード (BUG-185 一括分割 2026-07-10)
  colors: [
    '赤'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '高校生',
    '大学院生',
    '赤井家'
  ],
  rarity: 'MR',
  imageUrl: '1751538660431513.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/25-qa-effects-resolution.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
