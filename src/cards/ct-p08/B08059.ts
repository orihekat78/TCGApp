import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'and', cs: [
    { kind: 'turn', player: 'self' },
    { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 7 } }, nMin: 2 },
  ] },
  continuousModifier: { lvlDelta: 1, apDelta: 1000, grantKeywords: () => ['突撃'] },
  description: '【自分ターン中】自分の現場にレベル7のキャラが2枚以上いる場合、このキャラをレベル＋1し、AP＋1000し、〚突撃〛を持つ。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/13-keywords.md', 'rules/19-special-rules.md'],
};

export const B08059: CardDef = {
  id: 'B08059', no: '0897/B08059', kind: 'character', names: ['諸星大'], colors: ['赤'],
  level: 6, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '1770731238676358.jpg',
  abilities: [a1],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};
