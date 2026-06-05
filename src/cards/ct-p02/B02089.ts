// cards/ct-p02/B02089 探偵甲子園 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   この事件が解決編になったとき、相手はカードを1枚引く。
//
// a1: inline triggered — 解決編 (case:to-resolved hook) になったとき相手 draw n=1 (D08026 a1 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: この事件が解決編になったとき、相手はカードを1枚引く。
// case:to-resolved hook で発火 (selfOnly で自分の事件のみ gate)。effect は draw player:'opp'。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always', // 事件カードは case area 所在 → case:to-resolved hook + selfOnly で gate
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true, // 自分の事件カードが解決編になったときのみ発火
  },
  // 相手はカードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
  description: 'この事件が解決編になったとき、相手はカードを1枚引く。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

export const B02089: CardDef = {
  id: 'B02089',
  no: '0250/B02089',
  kind: 'case',
  names: ['探偵甲子園'],
  colors: ['緑', '白'],
  traits: [],
  rarity: 'C',
  imageUrl: '1721357309982654.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
