// cards/ct-p06/B06084 安室透＆榎本梓 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/21-declared-ability-cost.md, rules/09-cutin-disguise.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー黄】【登場時】相手は手札を公開する。（その後、元に戻す）レベル9以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】カードを1枚引き、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル7以下のカードが発見された場合、自分は手札を1枚リムーブする。この能力はパートナーエリアでも宣言できる。
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
  condition: {
    kind: 'partnerColor',
    color: '黄'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'log',
        args: {
          player: 'opp',
          action: 'reveal-hand',
          result: '相手は手札を公開する（その後、元に戻す）'
        }
      },
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          side: 'either',
          max: 1,
          filter: {
            kind: 'character',
            levelMax: 9
          },
          cause: 'effect'
        }
      }
    ]
  },
  description: '【パートナー黄】【登場時】相手は手札を公開する。（その後、元に戻す）レベル9以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
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
            levelMax: 7
          }
        },
        then: {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        }
      }
    ]
  },
  description: '【宣言】【ターン1】カードを1枚引き、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番でデッキの下に移す）する。レベル7以下のカードが発見された場合、自分は手札を1枚リムーブする。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
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

export const B06084: CardDef = {
  id: 'B06084',
  no: '0703/B06084',
  kind: 'character',
  names: [
    '安室透＆榎本梓'
  ],
  colors: [
    '黄'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'MR',
  imageUrl: '1751538660436483.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ],
};
