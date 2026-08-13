// cards/ct-p05/B05116 火傷の男 (character) — leave-from-remove wave
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ。                          ← a1
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル4以下の【黒】のキャラを1枚まで選び、スリープ状態で登場させる。  ← a2 出荷
// a1 は on-scene continuousModifier.mustBeSelectedByOppEvent による対象選択強制。
// a2 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】 => trigger {hook:'leave:to-remove', selfOnly:true} + condition {kind:'turn', player:'opp'} [B03113 a1]
//   - リムーブから登場 => sceneEnter {from:'remove', viaEffect:true} / レベル4以下 => levelMax:4 / 【黒】 => color:'黒' / キャラ => kind:'character' (BUG-123) [B02038 a2 同型 (色のみ差異)]
//   - 1枚まで => max:1 (n.min:0, rules/15) / スリープ状態で登場 => enterSleep:true

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { mustBeSelectedByOppEvent: true },
  description: '相手がイベントの効果でこのキャラを選べる場合、必ず選ぶ。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: { color: '黒', levelMax: 4, kind: 'character' },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル4以下の【黒】のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B05116: CardDef = {
  id: 'B05116',
  no: '0612/B05116',
  kind: 'character',
  names: ['火傷の男'],
  colors: ['黒'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322246381531.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
