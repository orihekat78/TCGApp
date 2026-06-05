// cards/ct-p09/B09093 ウォッカ (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【事件赤＆黒】〚突撃〛（名乗り状態でもアクションできる）
//   【自分ターン中】〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、このキャラをAP＋2000する。
//   【登場時】自分の現場に【赤】のキャラがいる場合、ターン終了時までこのキャラをAP＋1000する。
//
// a1: 【事件赤＆黒】continuous grantKeywords 突撃 (caseColor combine:'and')
// a2: 【自分ターン中】痕跡発見済 continuous apDelta self +2000 (turn AND scratchTrace)
// a3: 【登場時】赤キャラがいれば self AP+1000 (turn)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【事件赤＆黒】= 自分の事件が赤と黒の両方を持つ
  condition: { kind: 'caseColor', color: ['赤', '黒'], combine: 'and' },
  // 〚突撃〛
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '【事件赤＆黒】〚突撃〛',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 【自分ターン中】かつ 〚痕跡［発見済み］〛(engine 値は '発見済')
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'scratchTrace', player: 'self', v: '発見済' }] },
  // このキャラをAP＋2000する (D08005 a1 と同じ self-only continuous apDelta)
  continuousModifier: { apDelta: 2000 },
  description: '【自分ターン中】〚痕跡［発見済み］〛の場合、このキャラをAP＋2000する。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場に【赤】のキャラがいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '赤' } }, nMin: 1 },
    // ターン終了時までこのキャラをAP＋1000する
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
  },
  description: '【登場時】自分の現場に【赤】のキャラがいる場合、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09093: CardDef = {
  id: 'B09093',
  no: '1032/B09093',
  kind: 'character',
  names: ['ウォッカ'],
  colors: ['黒'],
  level: 6,
  ap: 5000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608926455017.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
