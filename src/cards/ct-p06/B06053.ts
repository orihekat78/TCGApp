// cards/ct-p06/B06053 鉄刃 (character) — wave decklook-enter-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p06/character.tsv col11。P 版 B06053P と effect 完全一致):
//   【登場時】自分のデッキのカードを上から〚特徴［YAIBA］〛のイベントが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//
// ※ filter{trait:'YAIBA', kind:'event'} のマッチ対象 = 実装済 YAIBA イベント (B06035 風神剣 / B06033 わが味方 等)。
//   これらは event.tsv の features 列欠落で従来 traits:[] だったが、本 wave で公式 API category1=YAIBA を
//   per-card 補完済 (先例 ef29f608 赤魔術 trait 補完)。よって match 経路は live (decoy test で witness)。
//
// 句マッピング (exemplar = B06010 a1 (src/cards/ct-p06/B06010.ts) — 「出るまで公開→手札に加える→残りデッキ下→シャッフル」完全 twin):
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}
//   - 〚特徴［YAIBA］〛のイベントが出るまで1枚ずつ公開し (maxN なし = match まで 1枚ずつ reveal)
//       => deckRevealUntil{filter:{trait:'YAIBA', kind:'event'}, bind:'$revealed', bindMatch:'$matched'}  (chooseMatch なし = 強制)
//       ※「のイベント」= kind:'event'。trait+kind は no-maxN path も targetFilterToPredicate で honor
//   - それを手札に加える => conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※ デッキに YAIBA イベントが1枚も無い場合は全公開して match 無し → 加えない (rules/15 可能な限り)
//   - 残りの公開したカードをデッキの下に移し => deckToBottomBound{$revealed}
//       ※ no-maxN path の $revealed は matched を除く (= match は手札へ、残りのみ下へ。B06010 と同)
//   - デッキをシャッフルする => deckShuffle

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
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filter: { trait: 'YAIBA', kind: 'event' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から〚特徴［YAIBA］〛のイベントが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B06053: CardDef = {
  id: 'B06053',
  no: '0674/B06053',
  kind: 'character',
  names: ['鉄刃'],
  colors: ['白'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285220485148.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
