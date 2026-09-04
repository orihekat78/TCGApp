// qa: card:B10086:4b2a237fb374afb6f9919d5fce12637e68a31dc97921b364bd78985f2cf851f9
// qa: card:B10086:50317442368bffff3164e68dc653f5aed385243d4499f8ae437484cbf3400043
// qa: card:B10086:bbcf6c6e561b8493d838734c5cad5404dfdf94cb80e494d39e7e83db9a7e4e5c
// qa: card:B10090:0c9d0e7ac8e1aeccc9186815ebf6f4fcbc776e2193db1d43e5cd7294a9e3a664

import { describe, expect, it } from 'vitest';
import { B10086 } from '@/cards/ct-p10/B10086';
import { B10090 } from '@/cards/ct-p10/B10090';

describe('official QA Wave211: CT-P10 Scotch and Vodka contracts', () => {
  it('B10086 observes every own Bourbon cut-in use, while granting only the contact cut-in ban', () => {
    expect(B10086.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      trigger: { hook: 'cutin:used', matcherCondition: { kind: 'and' } },
      effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
        { kind: 'atom', verb: 'charGrantAbility', args: { ability: { continuousModifier: { selfCutinBanInContact: true } } } },
      ] },
    });
  });

  it('B10086 always grants contact AP before the black cut-in draw check', () => {
    expect(B10086.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      scope: 'on-hand',
      effect: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
        { kind: 'conditional', if: { kind: 'contactCharMatches', who: 'byUid', filter: { color: '黒', keyword: 'カットイン' } }, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
      ] },
    });
  });

  it('B10090 cannot choose its optional top-three remove with fewer than three deck cards', () => {
    expect(B10090.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      effect: { kind: 'optional', effect: { kind: 'conditional', if: { kind: 'deckAtLeast', player: 'self', n: 3 }, then: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 3 } },
        { kind: 'atom', verb: 'boundToRemove', args: { player: 'self' } },
        { kind: 'conditional', if: { kind: 'boundMatchCountAtLeast', bindKey: '$removed', filter: { color: '黒', keyword: 'カットイン' }, n: 3 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } },
      ] } } },
    });
  });
});
