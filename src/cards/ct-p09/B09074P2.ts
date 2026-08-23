// cards/ct-p09/B09074P2 松田陣平 (character・パラレル2) — wave reveal-handadd (engine変更0)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (B09074 と同一効果。P2 版は no/rarity/imageUrl のみ異なる — effect 完全一致を TSV で確認済):
//   【疾風】カードを1枚引く。（自分の現場にこのターンで1番に登場したときに発動する）
//   【登場時】自分のデッキのカードを上から4枚見る。その中から【疾風】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//
// 句マッピング: B09074.ts と同一 (同テキスト別ファイル full def 慣行)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【疾風】カードを1枚引く。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { chooseMatch: 'upTo', player: 'self', maxN: 4, filter: { keyword: '疾風', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から4枚見る。その中から【疾風】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B09074P2: CardDef = {
  id: 'B09074P2',
  no: '1014/B09074P2',
  kind: 'character',
  names: ['松田陣平'],
  colors: ['黄'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1775608910253517.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
