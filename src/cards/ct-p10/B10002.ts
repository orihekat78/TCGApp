// CT-P10 B10002 比護隆佑 (partner)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

export const B10002: CardDef = {
  id: 'B10002', no: 'P083/B10002', kind: 'partner', names: ['比護隆佑'], colors: ['青'], lp: 1,
  traits: [], rarity: 'C', imageUrl: '1783904055240665.jpg', abilities: [], standardPartnerActions: true,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
export const B10002P: CardDef = { ...B10002, id: 'B10002P', no: 'P083/B10002P', rarity: 'CP', imageUrl: '1783904055246876.jpg' };
