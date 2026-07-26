// CT-P10 B10035 京極真 (partner)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

export const B10035: CardDef = {
  id: 'B10035', no: 'P085/B10035', kind: 'partner', names: ['京極真'], colors: ['白'], lp: 1,
  traits: [], rarity: 'C', imageUrl: '1783904116939471.jpg', abilities: [], standardPartnerActions: true,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
export const B10035P: CardDef = { ...B10035, id: 'B10035P', no: 'P085/B10035P', rarity: 'CP', imageUrl: '1783904116946310.jpg' };
