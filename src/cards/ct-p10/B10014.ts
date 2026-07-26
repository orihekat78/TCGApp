// CT-P10 B10014 妃英理
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene', continuousModifier: { grantTraits: ['毛利探偵事務所'] },
  description: '現場にいるこのキャラは〚特徴［毛利探偵事務所］〛を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', distinctNames: true, filter: { trait: '毛利探偵事務所' } }, nMin: 4 },
  continuousModifier: { lpDelta: 1 },
  description: '自分の現場にそれぞれカード名の異なる〚特徴［毛利探偵事務所］〛のキャラが4枚以上いる場合、このキャラをLP＋1する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '毛利探偵事務所' } } },
  description: '【ヒラメキ】自分のリムーブエリアにある〚特徴［毛利探偵事務所］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10014: CardDef = {
  id: 'B10014', no: '1076/B10014', kind: 'character', names: ['妃英理'], colors: ['青'], level: 6, ap: 5000, lp: 1,
  traits: ['弁護士'], rarity: 'C', imageUrl: '1783904094965393.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B10014P: CardDef = { ...B10014, id: 'B10014P', no: '1076/B10014P', rarity: 'CP', imageUrl: '1783904094973852.jpg' };
