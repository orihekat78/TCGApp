// cards/ct-p01/B01102 牧場に墜ちた火種 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   この事件が解決編になったとき、相手はカードを1枚引く。
//
// 先攻7 / 後攻6 (rules/01) — caseLevel は先攻基準。
// a1: inline triggered — 自分の事件が解決編 (case:to-resolved hook + selfOnly) になったとき
//     相手 (player:'opp') が 1 ドロー。D08026 a1 と同型 (player を opp に変更)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always', // 事件カードは case area 所在 → case:to-resolved hook + selfOnly で gate
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true, // 自分の事件カードが解決編になったときのみ発火 (相手の事件には誤発火しない)
  },
  // この事件が解決編になったとき、相手はカードを1枚引く。
  effect: { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
  description: 'この事件が解決編になったとき、相手はカードを1枚引く。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

export const B01102: CardDef = {
  id: 'B01102',
  no: '0090/B01102',
  kind: 'case',
  names: ['牧場に墜ちた火種'],
  colors: ['青', '黄'],
  traits: [],
  rarity: 'C',
  imageUrl: '1714013082090327.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
