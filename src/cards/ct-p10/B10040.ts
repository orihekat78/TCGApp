// CT-P10 B10040 織田國友
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1: AbilityDef = misreadX({ x: 1, abilityId: 'a1' });
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'opp', max: 1, filter: { hasFaceDownSetCards: true }, faceDownOnly: true } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ] },
  description: '【登場時】相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const B10040: CardDef = {
  id: 'B10040', no: '1100/B10040', kind: 'character', names: ['織田國友'], colors: ['白'], level: 4, ap: 3000, lp: 1,
  traits: ['消防士'], keywords: [], rarity: 'C', imageUrl: '1783904138002750.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};
