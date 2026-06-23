// cards/ct-p09/B09079 佐藤美和子 (character) — wave decklook-enter-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p09/character.tsv col11):
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚カード名［高木渉］〛を1枚まで公開して手札に加え、残りをリムーブエリアに移す。
//
// 句マッピング (exemplar = B07035 a1 (src/cards/ct-p07/B07035.ts) — 同一 deck-look 構造、tail句なし):
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}
//   - 上から3枚見る + 〚カード名［高木渉］〛を1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:3, filter:{cardName:'高木渉'}, bind:'$revealed', bindMatch:'$matched'}
//          → conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※「のキャラ」表記なし → kind 制約なし (カード名指定のみ)。cardName は allCardNameComponentsForDef で honor (split-name 対応)
//   - 残りをリムーブエリアに移す => boundToRemove{$revealed} (移送完了で deck0 なら refresh, rules/26)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 3,
          filter: { cardName: '高木渉' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から3枚見る。その中から〚カード名［高木渉］〛を1枚まで公開して手札に加え、残りをリムーブエリアに移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B09079: CardDef = {
  id: 'B09079',
  no: '1019/B09079',
  kind: 'character',
  names: ['佐藤美和子'],
  colors: ['黄'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608910323347.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
