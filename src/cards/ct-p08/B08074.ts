import type { AbilityDef, CardDef } from '@/engine/types';

const declaredTraitCount = (n: number) => ({
  kind: 'boundMatchCountAtLeast' as const,
  bindKey: '$revealed',
  traitBind: '$declaredTrait',
  filter: {},
  n,
});

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'traitChoice',
    bind: '$declaredTrait',
    then: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'opp', maxN: 3, visibility: 'public', viewer: 'all', presentation: 'reveal-to-bottom', bind: '$revealed' } },
        { kind: 'conditional', if: declaredTraitCount(1), then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '\u7a81\u6483[\u30ad\u30e3\u30e9]', scope: 'turn' } } },
        { kind: 'conditional', if: declaredTraitCount(2), then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '\u7a81\u6483', scope: 'turn' } } },
        { kind: 'conditional', if: declaredTraitCount(3), then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '\u8fc5\u901f', scope: 'turn' } } },
        { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'opp', bindKey: '$revealed' } },
      ],
    },
  },
  description: '\u3010\u767b\u5834\u6642\u3011\u301a\u7279\u5fb4\u301b\u30921\u3064\u6307\u5b9a\u3057\u3001\u301a\u636e\u67fb3\u301b\u3059\u308b\u3002',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08074: CardDef = {
  id: 'B08074', no: '0911/B08074', kind: 'character', names: ['\u964d\u8c37\u96f6'], colors: ['\u9ec4'], level: 6, ap: 6000, lp: 1,
  traits: ['\u8b66\u5bdf', '\u516c\u5b89'], keywords: [], rarity: 'C', imageUrl: '1770731255776582.jpg', abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
