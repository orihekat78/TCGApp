// cards/ct-p02/B02014 少年探偵団の活躍 (イベント) — Task D batch (2026-06-12)
// rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   自分の現場にいるレベル5以下の〚特徴［少年探偵団］〛のキャラを好きな数選び、ターン終了時まで
//   〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）と
//   「このキャラがアクションしたとき、カードを1枚引く。」を与える。
//
// 句マッピング:
//   a1: イベント使用トリガ (B02053 同型) → sequence
//     step1 (pick carrier): 「自分の現場にいるレベル5以下の[少年探偵団]のキャラを好きな数選び」+
//            「『このキャラがアクションしたとき、カードを1枚引く。』を与える」= charGrantAbility 短縮形
//            multi-pick (max:5 = 現場上限・0枚可 rules/15) + bind:'$picked' (E0 pick-share)。
//            granted ability (JSON descriptor): trigger {hook:'action:declare', selfOnly:true} + draw1
//            (公式Q&A: アクション宣言・対象指定・スリープ時点 = ガード判定前に発動 → action:declare
//             emit 位置と一致。validate.ts が JSON 性 + hook 許可を enforce)
//     step2: 「ターン終了時まで〚突撃[事件]〛…を与える」= forEach over fromBound '$picked' →
//            charGrantKeyword '$each.uid' (同一 picked 集合へ。公式Q&A: 片方だけ与えるのは不可 →
//            1 pick を bind 共有し両方付与。付与順はテキストと逆だが同時付与 rules/15 で語義不変)
//     ⚠ carrier は短縮形必須: charGrantKeyword を明示 uid:'$pick'+target carrier にすると初期 walk
//       push となり、human 経路で forEach が bind 未解決 no-op + AI が単一候補のみ選択になる
//       (2026-06-12 敵対レビュー vitest 実証)。charGrantAbility は短縮形対応 (atom-handlers.ts:959)
//       のため carrier に採用 — runtime push → continuation ctx 共有 / AI drain multi greedy。
//   付与効果はいずれも clearTurnEffects('turn') で清掃 (grantedKeywords / grantedAbilities) = ターン終了時まで

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいるレベル5以下の[少年探偵団]のキャラを好きな数選び (multi-pick carrier、bind:'$picked')、
      // 各キャラに「このキャラがアクションしたとき、カードを1枚引く。」(ターン終了時まで) を与える
      { kind: 'atom', verb: 'charGrantAbility', args: { player: 'self', max: 5, side: 'self', filter: { levelMax: 5, trait: '少年探偵団' }, bind: '$picked', scope: 'turn', ability: { trigger: { hook: 'action:declare', selfOnly: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: 'このキャラがアクションしたとき、カードを1枚引く。(B02014 付与)' } } },
      // 選んだ各キャラにターン終了時まで〚突撃[事件]〛を与える (同一 picked 集合)
      { kind: 'forEach', over: { kind: 'fromBound', bindKey: '$picked' }, do: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$each.uid', kw: '突撃[事件]', scope: 'turn' } } },
    ],
  },
  description: '自分の現場にいるレベル5以下の〚特徴［少年探偵団］〛のキャラを好きな数選び、ターン終了時まで〚突撃［事件］〛と「このキャラがアクションしたとき、カードを1枚引く。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

export const B02014: CardDef = {
  id: 'B02014',
  no: '0186/B02014',
  kind: 'event',
  names: ['少年探偵団の活躍'],
  colors: ['青'],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357188579757.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
