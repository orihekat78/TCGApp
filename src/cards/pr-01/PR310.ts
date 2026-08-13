// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene', continuousModifier: { grantKeywords: () => ['突撃[キャラ]'], printedKeywordWhenIconValid: true },
  description: '〚突撃［キャラ］〛', ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true, matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' } },
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黒' }, { kind: 'turn', player: 'self' }] },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { levelMax: 7 }, state: ['sleep'] } },
  description: '【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
export const PR310: CardDef = {
  id: 'PR310', no: '1163/PR310', kind: 'character', names: ['ベルモット'], colors: ['黒'], level: 6, ap: 5000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: [], rarity: 'PR', imageUrl: '1785395500844608.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
