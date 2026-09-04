// cards/ct-p02/B02050 中森銀三 (character) — wave reveal-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p02/character.tsv col11):
//   【登場時】自分のデッキのカードを上から【変装】を持つカードが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//
// 句マッピング (exemplar = B06053 a1 (src/cards/ct-p06/B06053.ts) — reveal-until→hand→deckBottom→shuffle 完全 twin):
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}
//   - 【変装】を持つカードが出るまで1枚ずつ公開し (maxN なし = match まで1枚ずつ reveal、chooseMatch なし = 強制取得)
//       => deckRevealUntil{filter:{keyword:'変装'}, bind:'$revealed', bindMatch:'$matched'}
//       ※ filter.keyword:'変装' は targetFilterToPredicate → defHasKeyword で印字判定 (icon-disguise ability 所持)。
//         中森銀三自身は henso 列空 = icon-disguise 無し → match 対象外 (QA「テキストに【変装】と書かれてるが能力は持たないカードは加えられない」と整合)。
//       ※「カードが出るまで」= kind 制限なし (B06053「イベントが」= kind:'event' と異なる)。
//   - それを手札に加える (必ず加える、加えない選択不可) => conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※ chooseMatch なし = 強制取得 (QA「いいえ、必ずそれを手札に加えます」)。デッキに変装持ち0なら全公開→match無し→加えない (rules/15)。
//   - 残りの公開したカードをデッキの下に移し => deckToBottomBound{$revealed}  ($revealed は matched を除く)
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
          filter: { keyword: '変装' },
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
    '【登場時】自分のデッキのカードを上から【変装】を持つカードが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B02050: CardDef = {
  id: 'B02050',
  no: '0216/B02050',
  kind: 'character',
  names: ['中森銀三'],
  colors: ['白'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357250020785.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
