// CT-P10 B10049 新出智明 (partner)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

export const B10049: CardDef = {
  id: 'B10049', no: 'P086/B10049', kind: 'partner', names: ['新出智明'], colors: ['赤'], lp: 1,
  traits: [], rarity: 'C', imageUrl: '1783904138073619.jpg', abilities: [], standardPartnerActions: true,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
export const B10049P: CardDef = { ...B10049, id: 'B10049P', no: 'P086/B10049P', rarity: 'CP', imageUrl: '1783904138080216.jpg' };
