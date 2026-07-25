// cards/ct-p05/B05114 弁崎桐平 (character) — wave reveal-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p05/character.tsv col11):
//   【宣言】〚デッキの下に移す〛：自分のデッキのカードを上から〚カード名［バーボン］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//
// 句マッピング (exemplar = B06053 a1 (reveal-until effect) + D07008 a1 (selfToDeckBottom cost)):
//   - 【宣言】 => type:'declared'
//   - 〚デッキの下に移す〛 (コスト、スリープアイコンなし = 自身をデッキ下へ) => cost:{kind:'selfToDeckBottom'}
//       ※ selfToDeckBottom は active 不要 (canPay=findChar(uid))。名乗り/スリープ状態でも宣言可 (rules/21)。
//   - 〚カード名［バーボン］〛が出るまで1枚ずつ公開し (maxN なし、chooseMatch なし = 強制取得)
//       => deckRevealUntil{filter:{cardName:'バーボン'}, bind:'$revealed', bindMatch:'$matched'}
//       ※ cardName 限定 (kind 制限なし = rules/19 複数名カードも分割名で match 可)。
//   - それを手札に加える (必ず加える) => conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※ QA「いいえ、必ずそれ(条件に合うカードで最初に公開されたもの)を手札に加えます」。
//   - 残りの公開したカードをデッキの下に移し => deckToBottomBound{$revealed}
//   - デッキをシャッフルする => deckShuffle

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'selfToDeckBottom' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filter: { cardName: 'バーボン' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【宣言】〚デッキの下に移す〛：自分のデッキのカードを上から〚カード名［バーボン］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05114: CardDef = {
  id: 'B05114',
  no: '0610/B05114',
  kind: 'character',
  names: ['弁崎桐平'],
  colors: ['黒'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['黒ずくめの組織', '花見客'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322246371515.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
