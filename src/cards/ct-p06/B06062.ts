// cards/ct-p06/B06062 かみなり斬り (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/14-refresh.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   AP8000以下のキャラを1枚まで選び、リムーブする。このイベントを自分の現場にいるレベル8以上の〚特徴［YAIBA］〛のキャラ1枚にセットする。自分のデッキのカードを上から3枚リムーブする。

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
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          filter: {
            apMax: 8000
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
      },
      {
        kind: 'atom',
        verb: 'mill',
        args: {
          player: 'self',
          n: 3,
          gate: false
        }
      }
    ]
  },
  description: 'AP8000以下のキャラを1枚まで選び、リムーブする。このイベントを自分の現場にいるレベル8以上の〚特徴［YAIBA］〛のキャラ1枚にセットする。自分のデッキのカードを上から3枚リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/14-refresh.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06062: CardDef = {
  id: 'B06062',
  no: '0683/B06062',
  kind: 'event',
  names: [
    'かみなり斬り'
  ],
  colors: [
    '白'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285220535505.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/14-refresh.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
