// cards/ct-d10/D10004 黒衣の騎士・スペイド（工藤新一） (character・パラレル) — wave reveal-handadd (engine変更0)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 26-qa-deck-refresh.md
//
// 公式テキスト (D10003 と同一効果。別アート版は no/imageUrl のみ異なる — effect 完全一致を TSV で確認済):
//   【事件シャッフルロマンス】〚突撃〛（登場したターンからすぐにアクションできる）
//   【登場時】自分のデッキのカードを上から〚カード名［シャッフルロマンス］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//
// 句マッピング: D10003.ts と同一 (同テキスト別ファイル full def 慣行)。

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
        args: { player: 'self', filter: { cardName: 'シャッフルロマンス' }, bind: '$revealed', bindMatch: '$matched' },
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
    '【登場時】自分のデッキのカードを上から〚カード名［シャッフルロマンス］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const D10004: CardDef = {
  id: 'D10004',
  no: '0838/D10004',
  kind: 'character',
  names: ['黒衣の騎士・スペイド（工藤新一）', '黒衣の騎士・スペイド', '工藤新一'],
  colors: ['青'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1761913165185252.jpg',
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
