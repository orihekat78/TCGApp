import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:intercept', optional: true, matcherCondition: { kind: 'and', cs: [
    { kind: 'turn', player: 'opp' },
    { kind: 'leaveCauseIn', causes: ['contact-ap', 'effect'] },
    { kind: 'leaveOwnerIs', player: 'self' },
  ] } },
  effect: { kind: 'atom', verb: 'leaveInterceptRedirect', args: { destination: 'hand' } },
  description: '\u76f8\u624b\u30bf\u30fc\u30f3\u4e2d\u3001\u4ed6\u306e\u81ea\u5206\u306e\u73fe\u5834\u306e\u30ad\u30e3\u30e9\u304c\u76f8\u624b\u306e\u80fd\u529b\u30fb\u52b9\u679c\u307e\u305f\u306f\u30b3\u30f3\u30bf\u30af\u30c8\u306b\u3088\u3063\u3066\u73fe\u5834\u3092\u96e2\u308c\u308b\u3068\u304d\u3001\u3053\u306e\u30ad\u30e3\u30e9\u3092\u30ea\u30e0\u30fc\u30d6\u3057\u3066\u3082\u3088\u3044\u3002\u305d\u306e\u5834\u5408\u3001\u4ee3\u308f\u308a\u306b\u305d\u306e\u30ad\u30e3\u30e9\u3092\u624b\u672d\u306b\u623b\u3059\u3002',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '\u3010\u3072\u3089\u3081\u304d\u3011\u30ab\u30fc\u30c91\u679a\u3092\u5f15\u304f\u3002',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01092: CardDef = {
  id: 'B01092', no: '0080/B01092', kind: 'character', names: ['\u677e\u7530\u9675\u5e73'],
  colors: ['\u9ec4'], level: 6, ap: 6000, lp: 1, traits: ['\u8b66\u5bdf', '\u8b66\u8996\u5e81'],
  keywords: [], rarity: 'C', imageUrl: '1714013082039905.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
