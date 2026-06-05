// cards/ct-p03/B03136 コナンvs．キッド　赤面の人魚 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   この事件が解決編になったとき、相手はカードを1枚引く。
//
// a1: inline triggered — 解決編 (case:to-resolved hook, selfOnly) になったとき 相手が1ドロー
//     (D08026 a1 同型の case:to-resolved trigger / draw player:'opp' で相手にドロー — B09099 a1 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always', // 事件カードは case area 所在 → case:to-resolved hook + selfOnly で gate
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true, // 自分の事件カードが解決編になったときのみ発火
  },
  // この事件が解決編になったとき、相手はカードを1枚引く。
  effect: { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
  description: 'この事件が解決編になったとき、相手はカードを1枚引く。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

export const B03136: CardDef = {
  id: 'B03136',
  no: '0385/B03136',
  kind: 'case',
  names: ['コナンvs．キッド　赤面の人魚'],
  colors: ['白', '赤'],
  traits: [],
  rarity: 'C',
  imageUrl: '1729133510472505.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
