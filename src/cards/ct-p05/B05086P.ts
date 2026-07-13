// cards/ct-p05/B05086P 安室透＆降谷零 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー黄】【ターン1】自分の現場にいる【黄】のキャラがアクションしたとき、AP8000以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】【黄】のキャラを1枚まで選び、ターン終了時までAP＋1000する。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      filter: {
        color: '黄'
      }
    }
  },
  condition: {
    kind: 'partnerColor',
    color: '黄'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        apMax: 8000
      }
    }
  },
  description: '【パートナー黄】【ターン1】自分の現場にいる【黄】のキャラがアクションしたとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md'
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
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      max: 1,
      side: 'either',
      filter: {
        color: '黄'
      },
      delta: 1000,
      scope: 'turn'
    }
  },
  description: '【宣言】【ターン1】【黄】のキャラを1枚まで選び、ターン終了時までAP＋1000する。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md'
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

export const B05086P: CardDef = {
  id: 'B05086P',
  no: '0584/B05086P',
  kind: 'character',
  names: ['安室透＆降谷零', '安室透', '降谷零'], // rules/19 複数名カード (BUG-185 一括分割 2026-07-10)
  colors: [
    '黄'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '警察',
    '喫茶ポアロ',
    '公安'
  ],
  rarity: 'MRP',
  imageUrl: '1747231543842572.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ],
};
