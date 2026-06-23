// cards/ct-p05/B05016P 小嶋元太 (character・パラレル) — wave decklook-enter-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (B05016 と同一効果。P 版は no/rarity/imageUrl のみ異なる — effect 完全一致を TSV で確認済):
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。
//
// 句マッピング: B05016.ts と同一 (同テキスト別ファイル full def 慣行 — B09073P 同様)。

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
          filter: { trait: '少年探偵団', kind: 'character' },
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
    '【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05016P: CardDef = {
  id: 'B05016P',
  no: '0522/B05016P',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1747231489433046.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
