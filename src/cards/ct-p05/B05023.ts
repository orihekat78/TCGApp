// cards/ct-p05/B05023 「探偵の毛利小五郎でございます…」 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   以下から1つ選んで行う。自分の現場に〚カード名［毛利小五郎］〛がいる場合、代わりに2つとも行う。(上から順に行う)\n・〚特徴［毛利探偵事務所］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。\n・キャラを1枚まで選び、スリープさせる。カードを1枚引く。

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
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          cardName: '毛利小五郎'
        }
      },
      nMin: 1
    },
    then: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            filter: {
              trait: '毛利探偵事務所',
              kind: 'character'
            },
            kw: '突撃',
            scope: 'turn'
          }
        },
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'sceneSetState',
              args: {
                player: 'self',
                max: 1,
                side: 'either',
                state: 'sleep'
              }
            },
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
        }
      ]
    },
    else: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            filter: {
              trait: '毛利探偵事務所',
              kind: 'character'
            },
            kw: '突撃',
            scope: 'turn'
          }
        },
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'sceneSetState',
              args: {
                player: 'self',
                max: 1,
                side: 'either',
                state: 'sleep'
              }
            },
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
        }
      ]
    }
  },
  description: '以下から1つ選んで行う。自分の現場に〚カード名［毛利小五郎］〛がいる場合、代わりに2つとも行う。(上から順に行う) ・〚特徴［毛利探偵事務所］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。 ・キャラを1枚まで選び、スリープさせる。カードを1枚引く。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B05023: CardDef = {
  id: 'B05023',
  no: '0529/B05023',
  kind: 'event',
  names: [
    '「探偵の毛利小五郎でございます…」'
  ],
  colors: [
    '青'
  ],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628061747450.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
