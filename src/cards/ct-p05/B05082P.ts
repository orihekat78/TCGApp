// cards/ct-p05/B05082P 「FBI…」 (event・パラレル) — wave reveal-handadd (engine変更0)
// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
//
// 公式テキスト (B05082 と同一効果。P 版は no/rarity/imageUrl のみ異なる — effect 完全一致を TSV で確認済):
//   自分のデッキのカードを上から5枚見る。その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。手札からレベル6以下の〚特徴［FBI］〛のキャラを1枚まで登場させる。
//
// 句マッピング: B05082.ts と同一 (同テキスト別ファイル full def 慣行)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { chooseMatch: 'upTo', player: 'self', maxN: 5, filter: { trait: 'FBI', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', deferRefresh: true } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { trait: 'FBI', levelMax: 6, kind: 'character' } } },
    ],
  },
  description:
    '自分のデッキのカードを上から5枚見る。その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。手札からレベル6以下の〚特徴［FBI］〛のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05082P: CardDef = {
  id: 'B05082P',
  no: '0582/B05082P',
  kind: 'event',
  names: ['「FBI…」'],
  colors: ['赤'],
  level: 6,
  traits: [],
  rarity: 'CP',
  imageUrl: '1747231524202968.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
