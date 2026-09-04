// cards/ct-p07/B07043 寺井黄之助 (character) — wave leave-reveal-until (engine変更0)
// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】〚カード名［黒羽盗一］〛か〚［黒羽快斗］〛か〚［怪盗キッド］〛から1つ指定する。自分のデッキのカードを上から指定したカード名のカードが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】(自身) => trigger{hook:'leave:to-remove', selfOnly:true} + condition{turn, player:'opp'}。exemplar D05007 a1
//   - 〚カード名 A〛か〚B〛か〚C〛から1つ指定する => choice{chooser:'self', options:[seq(A), seq(B), seq(C)]}
//       [choice DSL exemplar D02013。CPU/AI は option 0 (黒羽盗一) を実行 (choice≠optional ゆえ no-op でなく fire)。
//        human owner は 3択 modal (resolve-picks humanChooser path)。rec/B05035 wave と同じ許容]
//   - 指定したカード名のカードが出るまで1枚ずつ公開→手札に加える→残りデッキ下→シャッフル =>
//       各 option = sequence:[deckRevealUntil{cardName:X}, conditional{handAddFromDeck}, deckToBottomBound, deckShuffle] (B06053 a1 同型)
//   - 黒羽快斗 指定時の分割名マッチ (公式Q&A《怪盗キッド＆黒羽快斗》等) は allCardNameComponentsForDef が names[] 分割名を網羅 (規約)。
//     対象 split-name カードは未実装ゆえ end-to-end は latent だが design 上 faithful。

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

const revealUntilToHand = (cardName: string): Effect => ({
  kind: 'sequence',
  steps: [
    {
      kind: 'atom',
      verb: 'deckRevealUntil',
      args: { player: 'self', visibility: 'public', viewer: 'all', filter: { cardName }, bind: '$revealed', bindMatch: '$matched' },
    },
    {
      kind: 'conditional',
      if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
    },
    { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
    { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
  ],
});

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'choice',
    chooser: 'self',
    labels: ['黒羽盗一', '黒羽快斗', '怪盗キッド'],
    options: [revealUntilToHand('黒羽盗一'), revealUntilToHand('黒羽快斗'), revealUntilToHand('怪盗キッド')],
  },
  description:
    '【相手ターン中】【現場リムーブ時】〚カード名［黒羽盗一］〛か〚［黒羽快斗］〛か〚［怪盗キッド］〛から1つ指定する。自分のデッキのカードを上から指定したカード名のカードが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B07043: CardDef = {
  id: 'B07043',
  no: '0772/B07043',
  kind: 'character',
  names: ['寺井黄之助'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['バーテンダー'],
  rarity: 'C',
  imageUrl: '1762413994280797.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
