// cards/ct-p07/B07065 世良真純＆メアリー (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   【パートナー赤】【宣言】【ターン1】〚手札を1枚リムーブする〛：キャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】カードを1枚引く。この能力は自分の手札が2枚以下の場合に宣言できる。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '赤'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'removeFromHand',
    target: {
      kind: 'pick',
      query: {
        area: 'hand',
        side: 'self'
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either'
    }
  },
  description: '【パートナー赤】【宣言】【ターン1】〚手札を1枚リムーブする〛：キャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  condition: {
    kind: 'handAtMost',
    player: 'self',
    n: 2
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【宣言】【ターン1】カードを1枚引く。この能力は自分の手札が2枚以下の場合に宣言できる。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md'
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

export const B07065: CardDef = {
  id: 'B07065',
  no: '0794/B07065',
  kind: 'character',
  names: ['世良真純＆メアリー', '世良真純', 'メアリー'], // rules/19 複数名カード (BUG-185 一括分割 2026-07-10)
  colors: [
    '赤'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '高校生',
    '赤井家'
  ],
  rarity: 'MR',
  imageUrl: '1758249671512059.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
