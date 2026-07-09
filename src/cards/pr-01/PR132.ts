// cards/pr-01/PR132 諸伏景光 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー黄】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。これによって〚特徴［警察］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
// 句マッピング:
//   - 【パートナー黄】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい => optional{chain[mill{n3, gate true, bind $milled}, ...]} [してもよい = optional (B07037 同型)。公式Q&A本カード: デッキ2枚以下では行えない = gate true (all-or-nothing、rules/26)。bind = 本 wave 新設 (discard 同型 writeback)]
//   - これによって〚特徴［警察］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛を持つ => conditional{if boundAnyMatchesFilter $milled {trait 警察, kind character}, then charGrantKeyword $self 突撃 turn} [これによって = bind 集合限定 (removeTraitAtLeast の remove 全体計数は非等価)。boundAny = wave-5 出荷 (PR132 名指し)。charGrantKeyword scope turn = B04031 同型]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '黄'
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
            kind: 'boundAnyMatchesFilter',
            bindKey: '$milled',
            filter: {
              trait: [
                '警察'
              ],
              kind: 'character'
            }
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
  description: '【パートナー黄】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。これによって〚特徴［警察］〛のキャラがリムーブされた場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const PR132: CardDef = {
  id: 'PR132',
  no: '0619/PR132',
  kind: 'character',
  names: [
    '諸伏景光'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁',
    '公安'
  ],
  rarity: 'PR',
  imageUrl: '196f28d819c18b.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
