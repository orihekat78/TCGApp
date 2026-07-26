// CT-P10 B10020 沖田総司 (partner)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

export const B10020: CardDef = {
  id: 'B10020', no: 'P084/B10020', kind: 'partner', names: ['沖田総司'], colors: ['緑'], lp: 1,
  traits: [], rarity: 'C', imageUrl: '1783904095040956.jpg', abilities: [], standardPartnerActions: true,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
export const B10020P: CardDef = { ...B10020, id: 'B10020P', no: 'P084/B10020P', rarity: 'CP', imageUrl: '1783904095048606.jpg' };
