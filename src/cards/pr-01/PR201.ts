// cards/pr-01/PR201 鈴木次郎吉 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー白】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。これによって〚カード名［京極真］〛か〚特徴［鈴木財閥］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
// 句マッピング:
//   - 【パートナー白】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。これによって〚カード名［京極真］〛か〚特徴［鈴木財閥］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛を持つ => PR132 同型 + if = or[boundAny{cardName 京極真}, boundAny{trait 鈴木財閥}] [「か」= or 合成 (D06013 の and 対称)。cardName は分割名 any-match (rules/19)。filter は field AND ゆえ cardName と trait は別 boundAny に分ける]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '白'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'mill',
          args: {
            player: 'self',
            n: 3,
            gate: true,
            bind: '$milled'
          }
        },
        {
          kind: 'conditional',
          if: {
            kind: 'or',
            cs: [
              {
                kind: 'boundAnyMatchesFilter',
                bindKey: '$milled',
                filter: {
                  cardName: [
                    '京極真'
                  ],
                  kind: 'character'
                }
              },
              {
                kind: 'boundAnyMatchesFilter',
                bindKey: '$milled',
                filter: {
                  trait: [
                    '鈴木財閥'
                  ],
                  kind: 'character'
                }
              }
            ]
          },
          then: {
            kind: 'atom',
            verb: 'charGrantKeyword',
            args: {
              uid: '$self',
              kw: '突撃',
              scope: 'turn'
            }
          }
        }
      ]
    }
  },
  description: '【パートナー白】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。これによって〚カード名［京極真］〛か〚特徴［鈴木財閥］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const PR201: CardDef = {
  id: 'PR201',
  no: '0835/PR201',
  kind: 'character',
  names: [
    '鈴木次郎吉'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '鈴木財閥'
  ],
  rarity: 'PR',
  imageUrl: '1764290716040911.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
