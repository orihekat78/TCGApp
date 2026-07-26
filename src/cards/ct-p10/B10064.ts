// CT-P10 B10064 伊達航 (partner)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

export const B10064: CardDef = {
  id: 'B10064', no: 'P087/B10064', kind: 'partner', names: ['伊達航'], colors: ['黄'], lp: 1,
  traits: [], rarity: 'C', imageUrl: '1783904183342502.jpg', abilities: [], standardPartnerActions: true,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
export const B10064P: CardDef = { ...B10064, id: 'B10064P', no: 'P087/B10064P', rarity: 'CP', imageUrl: '1783904183349658.jpg' };
