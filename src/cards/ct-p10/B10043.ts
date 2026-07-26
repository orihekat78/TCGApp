// CT-P10 B10043 真田一三
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'マジシャン' } }, nMin: 5 },
  continuousModifier: { lpDelta: 1 }, description: '自分の現場に〚特徴［マジシャン］〛のキャラが5枚以上いる場合、このキャラをLP＋1する。',
  ruleRefs: ['rules/15-abilities-effects.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: 'マジシャン', cardNameNot: '真田一三' } } },
  description: '【カットイン】【相手ターン中】自分のリムーブエリアにある〚カード名［真田一三］〛以外の〚特徴［マジシャン］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};
export const B10043: CardDef = {
  id: 'B10043', no: '1103/B10043', kind: 'character', names: ['真田一三'], colors: ['白'], level: 6, ap: 6000, lp: 1,
  traits: ['マジシャン'], keywords: [], rarity: 'C', imageUrl: '1783904138023349.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
