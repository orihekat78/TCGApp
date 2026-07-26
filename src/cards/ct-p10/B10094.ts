// CT-P10 B10094 犯人
// rules: 03-field-areas.md, 15-abilities-effects.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  // on-evidence-file augments normal scene use: this character may also
  // declare while face-up in evidence / FILE.
  scope: 'on-evidence-file',
  cost: { kind: 'selfToRemove' },
  effect: {
    kind: 'atom',
    verb: 'partnerAreaRemove',
    args: {
      player: 'opp',
      cardIds: '$pick.cardIds',
      target: {
        kind: 'pick',
        query: {
          area: 'partner-area',
          side: 'opp',
          includePartner: false,
          includePartnerAreaCards: true,
          filterAny: [{ kind: 'character' }, { kind: 'event' }],
        },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description: '【宣言】〚リムーブエリアに移す〛：相手のパートナーエリアにあるキャラかイベントを1枚まで選び、リムーブする。この能力はこのカードが表向きで証拠エリアやFILEエリアにある場合でも宣言できる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B10094: CardDef = {
  id: 'B10094', no: '1149/B10094', kind: 'character', names: ['犯人'], colors: ['黒'], level: 4, ap: 4000, lp: 0,
  traits: ['犯人'], keywords: [], rarity: 'C', imageUrl: '1783904232373960.jpg', abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
