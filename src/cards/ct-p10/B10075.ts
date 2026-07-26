// CT-P10 B10075 佐藤美和子 — rules/07, 13, 15, 17, 24
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '高木渉' },
  continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true },
  description: '【絆高木渉】〚突撃〛（名乗り状態でもアクションできる）',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '高木渉' }, { kind: 'turn', player: 'self' }] },
  continuousModifier: {
    apDeltaAura: 1000,
    auraFilter: { color: '黄', trait: '警視庁', kind: 'character' },
    auraExcludeSelf: true,
  },
  description: '【絆高木渉】【自分ターン中】自分の現場にいるこのキャラ以外の【黄】の〚特徴［警視庁］〛のキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B10075: CardDef = {
  id: 'B10075',
  no: '1131/B10075',
  kind: 'character',
  names: ['佐藤美和子'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1783904202647973.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};
