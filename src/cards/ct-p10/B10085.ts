// CT-P10 B10085 キャンティ＆コルン
// rules: 08-contact.md, 09-cutin-disguise.md, 18-mr.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-partner-area', condition: { kind: 'partnerColor', color: '黒' }, limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeDeckTop', player: 'self', n: 3 },
  effect: { kind: 'conditional', if: { kind: 'costRemovedMatches', filter: { color: '黒', keyword: 'カットイン' }, n: 3 }, then: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: 9 } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ] } },
  description: 'コストで黒の【カットイン】を3枚以上リムーブした場合、レベル9以下を1枚までリムーブして1枚引く。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-partner-area', condition: { kind: 'turn', player: 'self' },
  trigger: { hook: 'cutin:used', matcherCondition: { kind: 'and', cs: [{ kind: 'triggerPlayerIs', side: 'self' }, { kind: 'contactCharMatches', who: 'byUid', filter: { kind: 'character' } }] } },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '自分の現場キャラのコンタクト中に自分が【カットイン】を使用したとき、そのキャラをAP＋2000する。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/18-mr.md'],
};
const a3: AbilityDef = { id: 'a3', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } }, description: '【カットイン】AP＋2000', ruleRefs: ['rules/09-cutin-disguise.md'] };
export const B10085: CardDef = {
  id: 'B10085', no: '1140/B10085', kind: 'character', names: ['キャンティ＆コルン', 'キャンティ', 'コルン'], colors: ['黒'], level: 9, ap: 8000, lp: 1, traits: ['黒ずくめの組織'], keywords: [], rarity: 'MR', imageUrl: '1783904202748296.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md'],
};
export const B10085P: CardDef = { ...B10085, id: 'B10085P', no: '1140/B10085P', rarity: 'MRP', imageUrl: '1783904202755125.jpg' };
