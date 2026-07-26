// CT-P10 B10063 萩原研二 (partner)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

export const B10063: CardDef = {
  id: 'B10063', no: 'P079/B10063', kind: 'partner', names: ['萩原研二'], colors: ['黄'], lp: 1,
  traits: [], rarity: 'C', imageUrl: '1783904159516086.jpg', abilities: [], standardPartnerActions: true,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
export const B10063P: CardDef = { ...B10063, id: 'B10063P', no: 'P079/B10063P', rarity: 'CP', imageUrl: '1783904159524888.jpg' };
export const B10063Sec1: CardDef = { ...B10063, id: 'B10063Sec1', no: 'P079/B10063Sec1', rarity: 'SEC', imageUrl: '1783904159531024.jpg' };
export const B10063Sec2: CardDef = { ...B10063, id: 'B10063Sec2', no: 'P079/B10063Sec2', rarity: 'SEC', imageUrl: '1783904183331886.jpg' };
