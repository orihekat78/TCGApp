// cards/ct-p05/B05058 富沢雄三 (character) — leave-from-remove wave
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   現場にいるこのキャラは〚特徴［鈴木財閥］〛を持つ。               ← a1
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある〚特徴［鈴木財閥］〛のキャラを1枚まで選び、手札に加える。  ← a2 出荷
// a1 は on-scene continuousModifier.grantTraits による現場限定付与。
// a2 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】 => trigger {hook:'leave:to-remove', selfOnly:true} + condition {kind:'turn', player:'opp'} [B03113 a1 / B04059 a2]
//   - リムーブエリアの〚特徴[鈴木財閥]〛を手札に加える => handAddFromRemove {player:'self', max:1, filter:{trait:'鈴木財閥', kind:'character'}} [B03005 a2 同型]
//   - 1枚まで => max:1 (n.min:0, rules/15)
//   - 自コピー除外: remove 候補は CardDef 静的 traits[絵描き] 参照で filter 不一致

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { grantTraits: ['鈴木財閥'] },
  description: '現場にいるこのキャラは〚特徴［鈴木財閥］〛を持つ。',
  ruleRefs: ['rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { trait: '鈴木財閥', kind: 'character' } },
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある〚特徴［鈴木財閥］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B05058: CardDef = {
  id: 'B05058',
  no: '0560/B05058',
  kind: 'character',
  names: ['富沢雄三'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['絵描き'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628061783068.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
