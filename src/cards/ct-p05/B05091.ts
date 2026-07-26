// cards/ct-p05/B05091 風見裕也 (character) — leave-from-remove wave (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【絆降谷零】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル6以下の〚カード名［降谷零］〛を1枚まで選び、スリープ状態で登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - a1 【絆降谷零】〚突撃[キャラ]〛 => continuous, condition {kind:'bond', cardName:'降谷零'}, continuousModifier grantKeywords ['突撃[キャラ]'] [B08010 a1 byte-identical (bond名のみ差異)]
//   - a2 【相手ターン中】【現場リムーブ時】 => trigger {hook:'leave:to-remove', selfOnly:true} + condition {kind:'turn', player:'opp'} [B03113 a1]
//   - リムーブから登場 => sceneEnter {from:'remove', viaEffect:true} / レベル6以下 => levelMax:6 / 〚カード名[降谷零]〛 => cardName:'降谷零' (分割名 安室透＆降谷零 も該当 rules/19) / キャラ => kind:'character' (BUG-123) / 1枚まで => max:1 (n.min:0) / スリープ状態で登場 => enterSleep:true
//   - a3 【ヒラメキ】キャラを1枚まで選びスリープ => triggered on-evidence, trigger {hook:'evidence:remove-by-action', optional:true}, sceneSetState sleep, pick area scene side either n{0,1} [D01012 a2 byte-identical]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '降谷零' },
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'], printedKeywordWhenIconValid: true },
  description: '【絆降谷零】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
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
      filter: { cardName: '降谷零', levelMax: 6, kind: 'character' },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル6以下の〚カード名［降谷零］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B05091: CardDef = {
  id: 'B05091',
  no: '0589/B05091',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1745322226182508.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md', 'rules/24-qa-naming-stun.md'],
};
