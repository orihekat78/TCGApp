// cards/ct-p06/B06047 鉄刃
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const abilities: AbilityDef[] = [
  { id: 'a1', type: 'continuous', scope: 'on-hand', continuousModifier: { lvlDeltaInHand: -1 }, description: '【手札】手札にあるこのカードはレベル−1する。', ruleRefs: ['rules/15-abilities-effects.md'] },
  { id: 'a2', type: 'triggered', scope: 'on-scene', condition: { kind: 'turn', player: 'self' }, trigger: { hook: 'setcard:enter', selfOnly: true, matcherCondition: { kind: 'setCardMatches', filter: { trait: 'YAIBA' } } }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '【自分ターン中】このキャラに〚特徴［YAIBA］〛のカードがセットされたとき、カードを1枚引く。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'] },
];

export const B06047: CardDef = { id: 'B06047', no: '0668/B06047', kind: 'character', names: ['鉄刃'], colors: ['白'], level: 8, ap: 7000, lp: 0, traits: ['YAIBA'], keywords: ['迅速'], rarity: 'R', imageUrl: '1754285220451879.jpg', abilities, ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'] };
