import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 3 },
  continuousModifier: { lpDelta: 1 },
  description: '自分の現場に〚特徴［警察］〛のキャラが3枚以上いる場合、このキャラをLP＋1する。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '高木渉' }, { kind: 'turn', player: 'self' }] },
  continuousModifier: { apDeltaAura: 1000, auraFilter: { cardName: '高木渉', kind: 'character' } },
  description: '【絆高木渉】【自分ターン中】自分の現場にいる〚カード名［高木渉］〛をAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '黄' },
  effect: { kind: 'conditional', if: { kind: 'removeTraitAtLeast', player: 'self', trait: '警察', n: 3 }, then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { levelMax: 8 } } } },
  description: '【パートナー黄】【登場時】自分のリムーブエリアに〚特徴［警察］〛のキャラが3枚以上ある場合、レベル8以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
export const B04069P: CardDef = {
  id: 'B04069P', no: '0455/B04069P', kind: 'character', names: ['佐藤美和子'], colors: ['黄'], level: 8, ap: 7000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [], rarity: 'SRP', imageUrl: '1735287822584992.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
