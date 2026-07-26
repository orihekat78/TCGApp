// CT-P10 B10070 萩原千速
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'removeFilterAtLeast', player: 'self', filters: [{ keyword: '疾風' }], n: 3 },
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '自分のリムーブエリアに【疾風】を持つカードが3枚以上ある場合、このキャラは【突撃】を持つ。', ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  condition: { kind: 'not', c: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' } },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 8 } } },
  ] } },
  description: '【疾風】このキャラをスリープさせてもよい。そうした場合、レベル8以下のキャラを1枚まで選び、リムーブする。', ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10070: CardDef = {
  id: 'B10070', no: '1126/B10070', kind: 'character', names: ['萩原千速'], colors: ['黄'], level: 7, ap: 5000, lp: 1,
  traits: ['警察', '神奈川県警'], keywords: [], rarity: 'R', imageUrl: '1783904183459750.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10070P: CardDef = { ...B10070, id: 'B10070P', no: '1126/B10070P', rarity: 'RP', imageUrl: '1783904183465236.jpg' };
