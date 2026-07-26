// CT-P10 B10069 高木渉
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'bond', cardName: '佐藤美和子' }] },
  continuousModifier: { lpDelta: 1 },
  description: '【パートナー黄】【絆佐藤美和子】LP＋1',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: ['佐藤美和子', '高木渉'] } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', apMaxSource: true } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ] },
  description: '【宣言】【ターン1】〚手札からカード名［佐藤美和子］か［高木渉］を1枚リムーブする〛：このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
export const B10069: CardDef = {
  id: 'B10069', no: '1125/B10069', kind: 'character', names: ['高木渉'], colors: ['黄'], level: 8, ap: 8000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [], rarity: 'R', imageUrl: '1783904183452202.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
