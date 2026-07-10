// cards/ct-p05/B05015 小嶋元次 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   相手が〚ミスリード〛したとき、ターン終了時までこのキャラをAP＋3000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにあるレベル6以下の〚カード名［小嶋元太］〛を1枚まで選び、登場させる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'misread:performed'
  },
  condition: {
    kind: 'triggerPlayerIs',
    side: 'opp'
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$self',
      delta: 3000,
      scope: 'turn'
    }
  },
  description: '相手が〚ミスリード〛したとき、ターン終了時までこのキャラをAP＋3000する。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
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
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      filter: {
        cardName: '小嶋元太',
        levelMax: 6,
        kind: 'character'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにあるレベル6以下の〚カード名［小嶋元太］〛を1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B05015: CardDef = {
  id: 'B05015',
  no: '0521/B05015',
  kind: 'character',
  names: [
    '小嶋元次'
  ],
  colors: [
    '青'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [
    '酒屋'
  ],
  rarity: 'C',
  imageUrl: '1746628061727275.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
