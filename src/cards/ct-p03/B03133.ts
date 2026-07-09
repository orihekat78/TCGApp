// cards/ct-p03/B03133 「見ィーつけた♪」 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   自分のリムーブエリアにある【カットイン】を持つレベル6以下の【黒】のキャラを2枚まで選び、手札に加える。手札から【カットイン】を持つレベル6以下の【黒】のキャラを1枚まで登場させる。ターン終了時までそのキャラに〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与える。

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
        verb: 'handAddFromRemove',
        // 「2枚まで」= multi-pick cardIds contract 必須 (short-form max:2 は 1 枚 collapse、B09034 同型)
        args: {
          player: 'self',
          cardIds: '$pick.cardIds',
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { keyword: 'カットイン', color: '黒', levelMax: 6, kind: 'character' } },
            n: { min: 0, max: 2 },
            chooser: 'self'
          },
          filter: {
            keyword: 'カットイン',
            color: '黒',
            levelMax: 6,
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'hand',
          viaEffect: true,
          bind: '$matched',
          target: {
            kind: 'pick',
            query: {
              area: 'hand',
              side: 'self',
              filter: {
                keyword: 'カットイン',
                color: '黒',
                levelMax: 6,
                kind: 'character'
              }
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$matched.uid',
          kw: '突撃[キャラ]',
          scope: 'turn'
        }
      }
    ]
  },
  description: '自分のリムーブエリアにある【カットイン】を持つレベル6以下の【黒】のキャラを2枚まで選び、手札に加える。手札から【カットイン】を持つレベル6以下の【黒】のキャラを1枚まで登場させる。ターン終了時までそのキャラに〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与える。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B03133: CardDef = {
  id: 'B03133',
  no: '0382/B03133',
  kind: 'event',
  names: [
    '「見ィーつけた♪」'
  ],
  colors: [
    '黒'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133510447153.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
