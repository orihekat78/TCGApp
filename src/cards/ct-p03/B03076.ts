// cards/ct-p03/B03076 世良真純 (character) — engine拡張 wave (evidence-flip-faceup 有効化, 2026-06-23)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
//
// 公式テキスト:
//   【登場時】相手の証拠を上から1つ表向きにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook:'enter', selfOnly:true} (自カードの登場で発火、B01014.ts a1 同型)
//   - 相手の証拠を上から1つ表向きにする => atom evidenceFlip {player:'opp', fromTop:true}
//     (engine拡張 wave 2026-06-23: fromTop=「上から1つ」= 末尾 index を deterministic に表向き化。
//      選択なし・必須 (まで/してもよい 無)。evidenceToHand fromTop と同型。相手証拠0 なら no-op)。
//   - 【ヒラメキ】カードを1枚引く => a2 {type:'triggered', scope:'on-evidence',
//     trigger:{hook:'evidence:remove-by-action', optional:true}, atom draw {player:'self',n:1}}
//     (VERBATIM PR006.ts a2 / B02079.ts a2。pendingHirameki fire/skip 経路)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  // 相手の証拠を上から1つ表向きにする (上から=末尾、選択なし・必須)
  effect: { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', fromTop: true } },
  description: '【登場時】相手の証拠を上から1つ表向きにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】(任意発動)
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03076: CardDef = {
  id: 'B03076',
  no: '0330/B03076',
  kind: 'character',
  names: ['世良真純'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['探偵', '高校生', '赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133424873057.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
