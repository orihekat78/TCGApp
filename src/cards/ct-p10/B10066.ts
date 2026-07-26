// CT-P10 B10066 伊達航
// rules: 08-contact.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a1' });
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'and', cs: [
    { kind: 'bond', cardName: '降谷零' },
    { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  ] },
  trigger: { hook: 'leave:to-remove' },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1, target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: ['諸伏景光', '萩原研二', '松田陣平'] } }, n: { min: 1, max: 1 }, chooser: 'self' } } },
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMax: 7 } } },
  ] } },
  description: '【絆降谷零】【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札から〚カード名［諸伏景光］〛か〚［萩原研二］〛か〚［松田陣平］〛を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md'],
};

export const B10066: CardDef = {
  id: 'B10066', no: '1122/B10066', kind: 'character', names: ['伊達航'], colors: ['黄'], level: 8, ap: 8000, lp: 2,
  traits: ['警察', '警視庁'], keywords: [], rarity: 'SR', imageUrl: '1783904183378314.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
export const B10066P: CardDef = { ...B10066, id: 'B10066P', no: '1122/B10066P', rarity: 'SRP', imageUrl: '1783904183385378.jpg' };
export const B10066P2: CardDef = { ...B10066, id: 'B10066P2', no: '1122/B10066P2', rarity: 'SRP', imageUrl: '1783904183392497.jpg' };
