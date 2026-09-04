// qa: card:B10009:62af49d53e7bf1d0384cf2ac1e300d0ea1a74c35b1a90a332e480c83f302dba1
// qa: card:B10010:ec1bfdd74283736ba7d21fad50868340ab7d6044671a292b8bc81eb359ff72c9
// qa: card:B10011:644edd6aaff6d40276ae76eac4a141f86871e35c829348b0da331d8b9bec9a0c
// qa: card:B10011:e75d64f485e9d46d74d66c1e7bcc4ceaf28d7a3888052bae4b053365e1929f18

import { describe, expect, it } from 'vitest';
import { B10009 } from '@/cards/ct-p10/B10009';
import { B10010 } from '@/cards/ct-p10/B10010';
import { B10011 } from '@/cards/ct-p10/B10011';

describe('official QA Wave203: CT-P10 blue triggered and bond contracts', () => {
  it('makes B10009 gain AP only after its owner character ability causes entry', () => {
    expect(B10009.abilities.find((ability) => ability.id === 'a3')).toMatchObject({
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
      condition: { kind: 'enterSource', viaEffect: true, side: 'self', sourceFilter: { kind: 'character' } },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
    });
  });

  it('keeps B10010 protected from opponent event removal only while its Ran bond is valid', () => {
    expect(B10010.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'continuous',
      scope: 'on-scene',
      condition: { kind: 'bond', cardName: '毛利蘭' },
      continuousModifier: { opponentEventRestrict: ['remove'] },
    });
  });

  it('limits B10011 cut-in to the declared contact character and its contact duration', () => {
    expect(B10011.abilities.find((ability) => ability.id === 'a2')).toMatchObject({
      type: 'triggered',
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      condition: { kind: 'contactCharMatches', who: 'byUid', filter: { cardName: ['工藤新一', '毛利蘭'] } },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    });
  });

  it('keeps B10011 protected from opponent event removal only while its Shinichi bond is valid', () => {
    expect(B10011.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'continuous',
      scope: 'on-scene',
      condition: { kind: 'bond', cardName: '工藤新一' },
      continuousModifier: { opponentEventRestrict: ['remove'] },
    });
  });
});
