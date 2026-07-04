// cards/ct-p03/B03104 24時間、年中無休 (event) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時までAP＋2000し、〚突撃［キャラ］〛を与える。自分のリムーブエリアにカードが15枚以上ある場合、代わりに自分の現場にいる〚特徴［警察］〛のキャラを2枚まで選び、ターン終了時までAP＋2000し、〚突撃［キャラ］〛を与える。

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
    kind: 'conditional',
    if: {
      kind: 'removeCountAtLeast',
      player: 'self',
      n: 15
    },
    then: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            side: 'self',
            filter: {
              trait: '警察'
            },
            max: 2,
            delta: 2000,
            scope: 'turn',
            bind: '$picked',
            player: 'self'
          }
        },
        {
          kind: 'forEach',
          over: {
            kind: 'fromBound',
            bindKey: '$picked'
          },
          do: {
            kind: 'atom',
            verb: 'charGrantKeyword',
            args: {
              uid: '$each.uid',
              kw: '突撃[キャラ]',
              scope: 'turn'
            }
          }
        }
      ]
    },
    else: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            side: 'self',
            filter: {
              trait: '警察'
            },
            max: 1,
            delta: 2000,
            scope: 'turn',
            bind: '$picked',
            player: 'self'
          }
        },
        {
          kind: 'forEach',
          over: {
            kind: 'fromBound',
            bindKey: '$picked'
          },
          do: {
            kind: 'atom',
            verb: 'charGrantKeyword',
            args: {
              uid: '$each.uid',
              kw: '突撃[キャラ]',
              scope: 'turn'
            }
          }
        }
      ]
    }
  },
  description: '自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時までAP＋2000し、〚突撃［キャラ］〛を与える。自分のリムーブエリアにカードが15枚以上ある場合、代わりに自分の現場にいる〚特徴［警察］〛のキャラを2枚まで選び、ターン終了時までAP＋2000し、〚突撃［キャラ］〛を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B03104: CardDef = {
  id: 'B03104',
  no: '0357/B03104',
  kind: 'event',
  names: [
    '24時間、年中無休'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133463336346.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
