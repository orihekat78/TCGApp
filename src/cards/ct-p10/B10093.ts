// CT-P10 B10093 銀髪の男
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';
const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', condition: { kind: 'caseColor', color: ['青', '黒'], combine: 'and' }, trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'handReveal', args: { player: 'self', max: 1, filter: { kind: 'character', cardName: ['工藤新一', '毛利蘭'] } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ] },
  description: '手札から工藤新一か毛利蘭を1枚公開してもよい。そうした場合、1枚引く。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
export const B10093: CardDef = {
  id: 'B10093', no: '1148/B10093', kind: 'character', names: ['銀髪の男'], colors: ['黒'], level: 4, ap: 3000, lp: 1, traits: ['黒ずくめの組織'], keywords: [], rarity: 'C', imageUrl: '1783904232366357.jpg', abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
