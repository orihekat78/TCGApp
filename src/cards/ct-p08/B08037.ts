// cards/ct-p08/B08037 鈴木園子 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【解決編】【宣言】【スリープ】：自分の現場にいる〚カード名［京極真］〛を1枚まで選び、
//     ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//
// 句マッピング:
//   - 【解決編】 => condition {kind:'caseStatus', status:'解決編'} (rules/17: 条件未達なら能力を持たない扱い → 宣言不可)
//   - 【宣言】【スリープ】 => type:'declared' + cost {kind:'sleepSelf'} (rules/21: スリープ/スタン状態では使用不可)
//   - 自分の現場にいる〚カード名［京極真］〛を1枚まで選び => charSetTurnEffect Pattern A 長形
//     {uid:'$pick', target:{kind:'pick', query:{area:'scene', side:'self', filter:{cardName:'京極真'}}, n:{min:0,max:1}, chooser:'owner'}}
//     (「1枚まで」= min0/skip可。rules/19 分割名: cardName は allCardNameComponentsForDef 照合)
//   - ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える =>
//     charSetTurnEffect key:'actionTargetsActive' val:true (Task D E4 token。
//     flow/action/target-expander.ts:114 が hasTextAbility 直読みで相手 active を対象拡張。
//     clearTurnEffects('turn') が自動清掃 = ターン終了時まで)
//
// 公式Q&A: 付与しても名乗り状態のキャラはアクション不可 (突撃/迅速が別途必要) —
//   本 token は対象拡張のみで、名乗り制限 (rules/03) の判定は engine 側で独立 → 裁定と一致。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【スリープ】(コスト: このキャラ自身をスリープ)
  cost: { kind: 'sleepSelf' },
  // 自分の現場にいる〚カード名［京極真］〛を1枚まで選び、ターン終了時まで「相手の現場にいるアクティブ状態のキャラを指定してアクションできる」を与える
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$pick', key: 'actionTargetsActive', val: true, target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '京極真' } }, n: { min: 0, max: 1 }, chooser: 'owner' } } },
  description:
    '【解決編】【宣言】【スリープ】：自分の現場にいる〚カード名［京極真］〛を1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B08037: CardDef = {
  id: 'B08037',
  no: '0876/B08037',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731222573696.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
