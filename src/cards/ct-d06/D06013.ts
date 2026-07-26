// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { visibility: 'public', viewer: 'all', player: 'self', maxN: 4, bind: '$revealed' } },
    { kind: 'conditional', if: { kind: 'and', cs: [
      { kind: 'boundAnyMatchesFilter', bindKey: '$revealed', filter: { color: '\u7dd1' } },
      { kind: 'boundAnyMatchesFilter', bindKey: '$revealed', filter: { color: '\u767d' } },
    ] }, then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'stun', target: { kind: 'pick', query: { area: 'scene', side: 'either', state: ['sleep'] }, n: { min: 0, max: 1 }, chooser: 'self' } } } },
    { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
  ] },
  description: '\u3010\u767b\u5834\u6642\u3011\u81ea\u5206\u306e\u30c7\u30c3\u30ad\u306e\u30ab\u30fc\u30c9\u3092\u4e0a\u304b\u30894\u679a\u516c\u958b\u3059\u308b\u3002',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const D06013: CardDef = { id: 'D06013', no: '0171/D06013', kind: 'character', names: ['\u767d\u99ac\u63a2'], colors: ['\u767d'], level: 6, ap: 5000, lp: 1, traits: ['\u63a2\u5075', '\u9ad8\u6821\u751f'], rarity: 'D', imageUrl: '1718844176833612.jpg', abilities: [a1], ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'] };
