// cards/ct-p06/B06099 ラム (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【事件黒】【パートナー黒】【登場時】レベル8以下のキャラを1枚まで選び、リムーブする。
//   【カットイン】【自分ターン中】AP＋3000（自分のターンのコンタクト中に手札からリムーブして使う）
//
// a1: 【事件黒】&【パートナー黒】 ゲートの登場時 → レベル8以下を1枚までリムーブ (D08003 a1 step2 同型 / sceneRemove)
// a2: 【カットイン】【自分ターン中】AP＋3000 — triggered on-hand (effect:declared) で コンタクト中の攻撃キャラを AP＋3000 (D08015 a2 同型 / 固定 delta + turn 条件)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件黒】【パートナー黒】
  condition: { kind: 'and', cs: [{ kind: 'caseColor', color: '黒' }, { kind: 'partnerColor', color: '黒' }] },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // レベル8以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 } } },
  description:
    '【事件黒】【パートナー黒】【登場時】レベル8以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // コンタクト中の攻撃キャラを AP＋3000 (固定 delta、コンタクト終了時まで)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】AP＋3000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B06099: CardDef = {
  id: 'B06099',
  no: '0716/B06099',
  kind: 'character',
  names: ['ラム'],
  colors: ['黒'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1751538660447533.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
