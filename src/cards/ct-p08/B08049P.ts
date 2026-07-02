// cards/ct-p08/B08049P ジョディ・スターリング (character・パラレル) — B3-1 unlock (engine変更0、wave-7 P17 exemplar clone)
// rules: 05-turn-phases.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md, 25-qa-effects-resolution.md
//
// 公式テキスト (B08049 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる):
//   自分のターン終了時、自分の現場に〚特徴［FBI］〛のキャラが4枚以上いる場合、カードを1枚引く。
//   【宣言】【ターン1】【スリープ】：自分の現場にいる、このターン中にアクション［キャラ］していた
//     〚特徴［FBI］〛のキャラを1枚まで選び、アクティブにする。
// 句マッピングは B08049.ts と同一 (同テキスト別ファイル full def 慣行 — B07047P / B03066P 同様)。
// DEFERRED-INDEX の「B08049P (RP clone) card-wave で出荷」予告の消化。

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

export const B08049P: CardDef = {
  id: 'B08049P',
  no: '0887/B08049P',
  kind: 'character',
  names: ['ジョディ・スターリング'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['FBI'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1770878984721033.jpg',
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
