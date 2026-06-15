// cards/ct-p07/B07052 ルシュファー (character) — 赤魔術 trait family (engine変更0, 手書き closure)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【事件赤魔術】〚突撃〛（登場したターンからすぐにアクションできる）
//   【登場時】自分のデッキのカードを上から〚特徴［赤魔術］〛のイベントが出るまで1枚ずつ公開し、
//     それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 公式Q&A (TSV qAndA 一次データ):
//   - 【事件赤魔術】= 自分の事件が特徴［赤魔術］を持つ場合にこの能力が有効になる。
//   - 赤魔術イベントが見つからずデッキを全公開した場合 → 何も加えず、公開分をすべてデッキに戻してシャッフル。
//   - 公開された赤魔術イベントを手札に加えないことはできない（必ず加える = forced）。
//
// 句マッピング:
//   - a1 【事件赤魔術】〚突撃〛 = caseTraitConditioned({trait:'赤魔術'}) で continuous grantKeywords ['突撃'] を
//     gate (rules/24 常時有効型 / rules/17 条件未達=非所持扱い)。grantKeywords は closure のため手書き
//     (B09008.ts a1 同型の continuous grantKeywords)。基礎は突撃を印字せず、事件が赤魔術 trait を持つ間のみ突撃。
//   - a2 【登場時】forced reveal-until(trait:赤魔術,event) → 手札 → 残りデッキ下 → シャッフル
//     = B05017.ts a1 完全同型 (filter を color:青 → trait:赤魔術 に変更のみ)。deckRevealUntil は maxN 無し
//     forced 型 (「出るまで1枚ずつ公開」「必ず加える」公式Q&A、chooseMatch なし)。trait filter は
//     targetFilterToPredicate (d.traits.includes('赤魔術')) AND kind:'event'。赤魔術 event は B07055/B07058
//     が traits:['赤魔術'] を持つ (公式 category1 由来、本 family で投入)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseTraitConditioned } from '@/cards/_shared';

// a1: 【事件赤魔術】〚突撃〛 — 事件が[赤魔術]を持つ間だけ continuous で突撃を付与。
const a1: AbilityDef = caseTraitConditioned({
  trait: '赤魔術',
  inner: {
    id: 'a1',
    type: 'continuous',
    scope: 'on-scene',
    continuousModifier: { grantKeywords: () => ['突撃'] },
    description: '〚突撃〛（登場したターンからすぐにアクションできる）',
    ruleRefs: ['rules/13-keywords.md', 'rules/24-qa-naming-stun.md'],
  },
});

// a2: 【登場時】[赤魔術]イベントが出るまで公開→手札→残りデッキ下→シャッフル (B05017 a1 同型)。
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
        args: { player: 'self', filter: { trait: '赤魔術', kind: 'event' }, bind: '$revealed', bindMatch: '$matched' },
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
  description: '【登場時】デッキ上から〚特徴［赤魔術］〛のイベントが出るまで1枚ずつ公開し、それを手札に加える。残りをデッキの下に移し、シャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B07052: CardDef = {
  id: 'B07052',
  no: '0781/B07052',
  kind: 'character',
  names: ['ルシュファー'],
  colors: ['白'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['邪神'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414010588827.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
