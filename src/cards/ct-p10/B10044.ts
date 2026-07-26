// CT-P10 B10044 シャロン・ヴィンヤード
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'disguise:into', selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', side: 'self', max: 1, filter: { cardName: '毛利蘭' }, delta: 2000, scope: 'turn' } },
  description: '【変装時】自分の現場にいる〚カード名［毛利蘭］〛を1枚まで選び、ターン終了時までAP＋2000する。', ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};
const a2: AbilityDef = { id: 'a2', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } }, description: '【カットイン】【相手ターン中】AP＋2000', ruleRefs: ['rules/09-cutin-disguise.md'] };
const a3: AbilityDef = { id: 'a3', type: 'icon-disguise', condition: { kind: 'and', cs: [{ kind: 'caseColor', color: ['青', '黒'], combine: 'and' }, { kind: 'fileAtLeast', n: 5 }] }, description: '【変装】【事件青＆黒】【FILE5】', ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'] };
export const B10044: CardDef = { id: 'B10044', no: '1104/B10044', kind: 'character', names: ['シャロン・ヴィンヤード'], colors: ['白'], level: 6, ap: 6000, lp: 1, traits: ['女優'], keywords: [], rarity: 'C', imageUrl: '1783904138030560.jpg', abilities: [a1, a2, a3], ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'] };
