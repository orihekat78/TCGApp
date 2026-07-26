// CT-P10 B10089 ヘルエンジェル
// rules: 09-cutin-disguise.md, 13-keywords.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene', condition: { kind: 'partnerColor', color: '黒' }, limit: { kind: 'turn', n: 1 }, cost: { kind: 'removeDeckTop', player: 'self', n: 3 },
  effect: { kind: 'conditional', if: { kind: 'costRemovedMatches', filter: { color: '黒', keyword: 'カットイン' }, n: 3 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', color: '黒', levelMin: 8, keyword: 'カットイン' }, kw: '突撃', scope: 'turn' } } },
  description: 'コストで黒の【カットイン】を3枚以上リムーブした場合、黒のレベル8以上【カットイン】キャラに突撃を与える。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/13-keywords.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
const a2: AbilityDef = { id: 'a2', type: 'triggered', scope: 'on-hand', condition: { kind: 'turn', player: 'self' }, trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } }, description: '【カットイン】AP＋1000', ruleRefs: ['rules/09-cutin-disguise.md'] };
export const B10089: CardDef = {
  id: 'B10089', no: '1144/B10089', kind: 'character', names: ['ヘルエンジェル'], colors: ['黒'], level: 6, ap: 5000, lp: 1, traits: ['黒ずくめの組織'], keywords: [], rarity: 'R', imageUrl: '1783904232337126.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/13-keywords.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
