// cards/ct-p09/B09095 ベルモット (character) — engine mini-wave #4 (hand 内 continuous level) 同梱 exemplar
// rules: rules/12-next-hint.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   〚突撃〛（名乗り状態でもアクションできる）
//   【事件赤＆黒】【解決編】【自分ターン中】〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、手札にあるこのキャラはレベル－2される。
//   【登場時】〚痕跡［未発見］〛の場合、相手のデッキのカードを上から2枚リムーブする。
// 公式QA:
//   - 「レベルがマイナスされた状態で使用した（登場した）このキャラは、現場でもそのレベルのままですか？」→ いいえ。
//     手札にある間だけ (現場ではレベル7) → lvlDeltaInHand は hand gate 専用 (scene level 読み不変)
//   - 「相手のデッキが残り1枚以下の場合は？」→ 可能な限りリムーブ→リフレッシュ、残り枚数はリムーブしない
//     (rules/14 / rules/26 — atom mill の既存挙動)
// 句マッピング:
//   - 〚突撃〛 => keywords:['突撃'] (印字キーワード) [VERBATIM src/cards/ct-p09/B09032.ts 等の印字 keywords]
//   - 【事件赤＆黒】 => {kind:'caseColor', color:['赤','黒'], combine:'and'} [VERBATIM B09092.ts:79 / B09003.ts:60
//     (rules/17 「&」= すべての色を持つ)]
//   - 【解決編】 => {kind:'caseStatus', status:'解決編'} [VERBATIM D08019.ts:16]
//   - 【自分ターン中】 => {kind:'turn', player:'self'} [VERBATIM B09003.ts:46]
//   - 〚痕跡［発見済み］〛の場合 => {kind:'scratchTrace', player:'self', v:'発見済'} [VERBATIM B09056.ts / B09099.ts:22
//     (engine 値は '発見済'、cond/eval.ts:255-257)]
//   - 手札にあるこのキャラはレベル－2される => scope:'on-hand' continuous + continuousModifier{lvlDeltaInHand:-2}
//     [engine mini-wave #4 primitive。effectiveHandLevel が hand 4 site で honor、下限なし rules/19。
//     tests/engine/effect/miniwave4-hand-level.test.ts pin]
//   - 【登場時】 => trigger:{hook:'enter', selfOnly:true} [VERBATIM B09064.ts a2 (on-hand triggered ではないが
//     enter selfOnly は on-scene triggered の標準形、BUG-032)]
//   - 〚痕跡［未発見］〛の場合、相手のデッキのカードを上から2枚リムーブする =>
//     conditional{if:scratchTrace 未発見, then:atom mill{player:'opp', n:2}} [VERBATIM B09064.ts a2 (n:4→2 のみ差)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-hand',
  // 【事件赤＆黒】【解決編】【自分ターン中】〚痕跡［発見済み］〛
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: ['赤', '黒'], combine: 'and' },
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'turn', player: 'self' },
      { kind: 'scratchTrace', player: 'self', v: '発見済' },
    ],
  },
  // 手札にあるこのキャラはレベル-2される (hand gate 専用 — 現場ではレベル7のまま、公式QA)
  continuousModifier: { lvlDeltaInHand: -2 },
  description:
    '【事件赤＆黒】【解決編】【自分ターン中】〚痕跡［発見済み］〛の場合、手札にあるこのキャラはレベル－2される。',
  ruleRefs: ['rules/12-next-hint.md', 'rules/13-keywords.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 〚痕跡［未発見］〛の場合
    if: { kind: 'scratchTrace', player: 'self', v: '未発見' },
    // 相手のデッキのカードを上から2枚リムーブする (デッキ不足時は可能な限り→リフレッシュ rules/14)
    then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } },
  },
  description: '【登場時】〚痕跡［未発見］〛の場合、相手のデッキのカードを上から2枚リムーブする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09095: CardDef = {
  id: 'B09095',
  no: '1034/B09095',
  kind: 'character',
  names: ['ベルモット'],
  colors: ['黒'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: ['突撃'],
  rarity: 'R',
  imageUrl: '1775608926493320.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
