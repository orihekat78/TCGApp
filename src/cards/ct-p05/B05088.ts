import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '上原由衣' }, { kind: 'turn', player: 'self' }] },
  continuousModifier: { apDelta: 1000 },
  description: '【絆上原由衣】【自分ターン中】このキャラのAP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'remove:exit', matcherCondition: { kind: 'removeExitMatches', side: 'self', removeFilter: { trait: '長野県警', kind: 'character' } } },
  condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', max: 1, side: 'either', delta: -1000, scope: 'turn' } },
  description: '【自分ターン中】【ターン1】自分のリムーブエリアにある〚長野県警〛のキャラがリムーブエリアから離れたとき、キャラを1枚まで選び、ターン終了時までAP−1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'declared', scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' }, limit: { kind: 'turn', n: 1 },
  cost: { kind: 'pay', items: [{ kind: 'removeAreaToDeckBottom', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { trait: '長野県警', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'owner' }, n: 1 }] },
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  description: '【パートナー黄】【宣言】【ターン1】[自分のリムーブエリアにある〚長野県警〛のキャラを1枚デッキの下に置く]：ターン終了時まで、このキャラは【突撃】を得る。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B05088: CardDef = {
  id: 'B05088', no: '0586/B05088', kind: 'character', names: ['大和敢助'], colors: ['黄'], level: 7, ap: 6000, lp: 1,
  traits: ['警察', '長野県警'], rarity: 'SR', imageUrl: '1743742488544993.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/05-turn-phases.md'],
};
