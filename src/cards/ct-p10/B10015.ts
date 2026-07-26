// CT-P10 B10015 毛利小五郎
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 24-qa-naming-stun.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  continuousModifier: {
    grantTraitsAura: ['毛利探偵事務所'],
    auraFilter: { kind: 'character', cardName: '妃英理' },
  },
  description: '自分の現場にいる〚カード名［妃英理］〛は〚特徴［毛利探偵事務所］〛を持つ。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', distinctNames: true, filter: { trait: '毛利探偵事務所' } }, nMin: 4 },
  continuousModifier: { grantKeywords: () => ['迅速'] },
  description: '自分の現場にそれぞれカード名の異なる〚特徴［毛利探偵事務所］〛のキャラが4枚以上いる場合、このキャラは〚迅速〛（名乗り状態でも推理かアクションできる）を持つ。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', cardName: '妃英理' } } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［妃英理］〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

export const B10015: CardDef = {
  id: 'B10015', no: '1077/B10015', kind: 'character', names: ['毛利小五郎'], colors: ['青'],
  level: 6, ap: 5000, lp: 1, traits: ['探偵', '毛利探偵事務所'], keywords: [], rarity: 'C', imageUrl: '1783904094980534.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
