// CT-P10 B10062 松田陣平 (partner, two SEC printings)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

const base = {
  kind: 'partner' as const, names: ['松田陣平'], colors: ['黄'], lp: 1, traits: [], rarity: 'SEC' as const,
  abilities: [], standardPartnerActions: true as const, ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};

export const B10062Sec1: CardDef = { ...base, id: 'B10062Sec1', no: 'P038/B10062Sec1', imageUrl: '1783904159501399.jpg' };
export const B10062Sec2: CardDef = { ...base, id: 'B10062Sec2', no: 'P038/B10062Sec2', imageUrl: '1783904159509414.jpg' };
