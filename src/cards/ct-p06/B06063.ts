// cards/ct-p06/B06063 せんぷう剣 (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md
// 公式テキスト:
//   相手の現場にいるレベル7以下のキャラを1枚まで選び、手札に移す。このイベントを自分の現場にいるレベル8以上の〚特徴［YAIBA］〛のキャラ1枚にセットする。\nこのイベントがセットされているキャラは「【自分ターン中】AP＋2000」を持つ。

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
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneToHand',
        args: {
          player: 'self',
          max: 1,
          side: 'opp',
          filter: {
            levelMax: 7
          }
        }
      },
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: {
          player: 'self',
          fromSelf: true,
          n: 1,
          filter: {
            levelMin: 8,
            trait: 'YAIBA',
            kind: 'character'
          }
        }
      }
    ]
  },
  description: '相手の現場にいるレベル7以下のキャラを1枚まで選び、手札に移す。このイベントを自分の現場にいるレベル8以上の〚特徴［YAIBA］〛のキャラ1枚にセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-set-host',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  continuousModifier: {
    apDelta: 2000
  },
  description: 'このイベントがセットされているキャラは「【自分ターン中】AP＋2000」を持つ。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

export const B06063: CardDef = {
  id: 'B06063',
  no: '0684/B06063',
  kind: 'event',
  names: [
    'せんぷう剣'
  ],
  colors: [
    '白'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285220541955.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ],
};
