// cards/ct-p08/B08049 ジョディ・スターリング (キャラ) — engine additive wave-7 exemplar (2026-07-02, P17)
// rules: 05-turn-phases.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   自分のターン終了時、自分の現場に〚特徴［FBI］〛のキャラが4枚以上いる場合、カードを1枚引く。
//   【宣言】【ターン1】【スリープ】：自分の現場にいる、このターン中にアクション［キャラ］していた
//     〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする。
//
// 句マッピング:
//   a1: 自分のターン終了時 => trigger {hook:'phase:end:start'} + condition {kind:'turn', player:'self'}
//       (phase:end:start は両ターン発火 → turn:self で gate。B08058 a1 同型)。
//       自分の現場に特徴[FBI]が4枚以上いる場合 => 公式Q&A「効果の解決時に判定・このキャラ自身も数える」
//       → ability.condition (発火時評価) でなく effect 内 conditional.if で解決時評価。
//       sceneHas {query:{area:'scene', side:'self', filter:{trait:['FBI']}}, nMin:4}。
//       カードを1枚引く => draw n:1 (「〜する」= 必須、rules/15)。
//   a2: 【宣言】【ターン1】【スリープ】 => type:'declared' + limit {kind:'turn', n:1} + cost {kind:'sleepSelf'}
//       (rules/21: sleepSelf は自身をスリープ = active でなければ支払い不可)。
//       自分の現場にいる、このターン中にアクション[キャラ]していた特徴[FBI]のキャラを1枚まで選び、アクティブにする
//       => sceneSetState {player:'self', side:'self', max:1, state:'active', filter:{trait:'FBI', actedCharThisTurn:true}}。
//       actedCharThisTurn = wave-7 P17 の TargetFilter 軸: このターン中に action:declare を target.kind==='char' で
//       行った board char のみ (state-machine.declare が setTurnEffect、clearTurnEffects('turn') で失効)。
//       アクション[事件] は含まない (rules/22)。max:1 → 0枚選択可 (rules/15「〜まで」)。
//       アクティブにする = sceneSetState state:'active' (B05096/B07056 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時 (phase:end:start は両ターン発火 → turn:self で gate)
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分の現場に特徴[FBI]が4枚以上 (Q&A: 解決時判定・自身も数える)
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: ['FBI'] } }, nMin: 4 },
    // カードを1枚引く (必須)
    then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  },
  description: '自分のターン終了時、自分の現場に〚特徴［FBI］〛のキャラが4枚以上いる場合、カードを1枚引く。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/25-qa-effects-resolution.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】(自身をスリープ = active 時のみ支払い可、rules/21)
  cost: { kind: 'sleepSelf' },
  // 自分の現場にいる、このターン中にアクション[キャラ]していた特徴[FBI]のキャラを1枚まで選び、アクティブにする
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', side: 'self', max: 1, state: 'active', filter: { trait: 'FBI', actedCharThisTurn: true } },
  },
  description: '【宣言】【ターン1】【スリープ】：自分の現場にいる、このターン中にアクション［キャラ］していた〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md'],
};

export const B08049: CardDef = {
  id: 'B08049',
  no: '0887/B08049',
  kind: 'character',
  names: ['ジョディ・スターリング'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['FBI'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731238611947.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
