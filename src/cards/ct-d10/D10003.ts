// cards/ct-d10/D10003 黒衣の騎士・スペイド（工藤新一） (character) — wave reveal-handadd (engine変更0)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-d10/character.tsv col11):
//   【事件シャッフルロマンス】〚突撃〛（登場したターンからすぐにアクションできる）
//   【登場時】自分のデッキのカードを上から〚カード名［シャッフルロマンス］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//
// 句マッピング (exemplar = partnerColorKeyword (continuous grantKeywords) + caseTraitConditioned (事件特徴 gate) + B06053 a1 (reveal-until)):
//   a1【事件シャッフルロマンス】〚突撃〛:
//   - 常時有効型 keyword 付与 (条件成立中のみ突撃) => continuous + continuousModifier.grantKeywords:()=>['突撃']
//   - 【事件シャッフルロマンス】= 自分の事件が特徴[シャッフルロマンス]を持つ場合 (QA確認) => caseTraitConditioned({trait, inner})
//       ※ caseTraitConditioned が inner.condition に {kind:'caseTrait', trait:'シャッフルロマンス'} を AND 追加。
//   a2【登場時】:
//   - 〚カード名[シャッフルロマンス]〛が出るまで1枚ずつ公開 (maxN なし、chooseMatch なし = 強制取得) => deckRevealUntil{filter:{cardName:'シャッフルロマンス'}}
//   - それを手札に加える (必ず) => cond($matched) handAddFromDeck
//   - 残りをデッキの下に移し => deckToBottomBound{$revealed}
//   - デッキをシャッフルする => deckShuffle
// 名前 (rules/19): 「（ ）」表記 → 全分割名を持つ。names=['黒衣の騎士・スペイド（工藤新一）','黒衣の騎士・スペイド','工藤新一'] (QA確認)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseTraitConditioned } from '../_shared/index.js';

const a1: AbilityDef = caseTraitConditioned({
  trait: 'シャッフルロマンス',
  inner: {
    id: 'a1',
    type: 'continuous',
    scope: 'on-scene',
    continuousModifier: { grantKeywords: () => ['突撃'] },
    // ※ description は prefix 無し — caseTraitConditioned が 【事件シャッフルロマンス】 を付与 (B07047/B07052 慣行、二重prefix防止)
    description: '〚突撃〛（登場したターンからすぐにアクションできる）',
    ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
  },
});

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
        args: { visibility: 'public', viewer: 'all', player: 'self', filter: { cardName: 'シャッフルロマンス' }, bind: '$revealed', bindMatch: '$matched' },
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
    '【登場時】自分のデッキのカードを上から〚カード名［シャッフルロマンス］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const D10003: CardDef = {
  id: 'D10003',
  no: '0838/D10003',
  kind: 'character',
  names: ['黒衣の騎士・スペイド（工藤新一）', '黒衣の騎士・スペイド', '工藤新一'],
  colors: ['青'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1761913165177685.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
