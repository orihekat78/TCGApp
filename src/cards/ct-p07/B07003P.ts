// cards/ct-p07/B07003P 工藤新一 (character parallel)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
import type { CardDef } from '@/engine/types';
import { B07003_ABILITIES } from './B07003';

export const B07003P: CardDef = {
  id: 'B07003P', no: '0735/B07003P', kind: 'character', names: ['工藤新一'], colors: ['青'],
  level: 8, ap: 7000, lp: 2, traits: ['探偵', '高校生'], keywords: [], rarity: 'RP',
  imageUrl: '1763546798233422.jpg', abilities: B07003_ABILITIES,
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
