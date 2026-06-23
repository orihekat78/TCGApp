// cards/ct-p05/B05058 富沢雄三 (character) — leave-from-remove wave (a2のみ / a1 DEFER, engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   現場にいるこのキャラは〚特徴［鈴木財閥］〛を持つ。               ← a1 DEFER
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある〚特徴［鈴木財閥］〛のキャラを1枚まで選び、手札に加える。  ← a2 出荷
// a1 DEFER 理由 (DEFERRED-INDEX §leave-from-remove): 「現場にいるこのキャラは〚特徴[X]〛を持つ」=
//   現場限定の継続 self-trait 付与。engine に trait 付与機構が無い (read/char.ts:156 readTraits は
//   d.traits 静的のみ / charGrantTrait atom 不在 / ContinuousModifier に grantTraits 無し)。
//   静的 traits[] へ入れるのは「現場にいる間のみ」公式Q&A (デッキ/手札/リムーブでは鈴木財閥でない) に
//   反するため不可。先例 ct-p04/B04059 (a1 動的名前付与 DEFER + a2 leave 出荷) と同型の partial-ship。
// a2 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】 => trigger {hook:'leave:to-remove', selfOnly:true} + condition {kind:'turn', player:'opp'} [B03113 a1 / B04059 a2]
//   - リムーブエリアの〚特徴[鈴木財閥]〛を手札に加える => handAddFromRemove {player:'self', max:1, filter:{trait:'鈴木財閥', kind:'character'}} [B03005 a2 同型]
//   - 1枚まで => max:1 (n.min:0, rules/15)
//   - 自コピー除外: 公式Q&A「リムーブの本カードは鈴木財閥を持たない」→ remove 候補は CardDef 静的 traits[絵描き] 参照で
//     a1 継続付与が無効ゆえ自然に filter 不一致 (excludeSelf/cardNameNot 不要)

import type { AbilityDef, CardDef } from '@/engine/types';

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
  abilities: [a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
