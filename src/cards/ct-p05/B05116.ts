// cards/ct-p05/B05116 火傷の男 (character) — leave-from-remove wave (a2のみ / a1 DEFER, engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ。                          ← a1 DEFER
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル4以下の【黒】のキャラを1枚まで選び、スリープ状態で登場させる。  ← a2 出荷
// a1 DEFER 理由 (DEFERRED-INDEX §leave-from-remove): 「相手はイベントの効果によってこのキャラを
//   選べる場合、必ず選ぶ」= 相手のイベント効果の対象選択を強制する継続 passive (forced-target)。
//   engine に強制対象選択機構が無い (必ず選ぶ/mustSelect/forcedTarget 共に cards/engine ゼロ)。
//   先例 ct-p04/B04059 と同型の partial-ship (継続 passive を DEFER + a2 leave 出荷)。
// a2 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】 => trigger {hook:'leave:to-remove', selfOnly:true} + condition {kind:'turn', player:'opp'} [B03113 a1]
//   - リムーブから登場 => sceneEnter {from:'remove', viaEffect:true} / レベル4以下 => levelMax:4 / 【黒】 => color:'黒' / キャラ => kind:'character' (BUG-123) [B02038 a2 同型 (色のみ差異)]
//   - 1枚まで => max:1 (n.min:0, rules/15) / スリープ状態で登場 => enterSleep:true

import type { AbilityDef, CardDef } from '@/engine/types';

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
  abilities: [a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
