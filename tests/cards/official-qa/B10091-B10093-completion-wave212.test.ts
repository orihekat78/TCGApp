// qa: card:B10091:b082b43876d7f849856b8314d6da889c9c50fe270f10c42952cec228b98720ed
// qa: card:B10091:cca36b1e251a280c312c55711c6247c447a5e47dc100cd22f398004803583af3
// qa: card:B10091:e22ac7bcad9c85026193a426a26c54897faefb515b3bf005f716238ef964f5c4
// qa: card:B10093:d57061e168377282a7f780219f1db504860fe4b23e140fa7f52f30bce369491e

import { describe, expect, it } from 'vitest';
import { B10091 } from '@/cards/ct-p10/B10091';
import { B10093 } from '@/cards/ct-p10/B10093';

describe('official QA Wave212: CT-P10 Calvados and Silver-Haired Man contracts', () => {
  it('B10091 counts its own black cut-in text in the four-character Assault condition', () => {
    expect(B10091.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'continuous',
      condition: { kind: 'sceneHas', nMin: 4, query: { area: 'scene', side: 'self', filter: { color: '黒', cutinTextIncludes: '' } } },
      continuousModifier: { grantKeywords: expect.any(Function) },
    });
  });

  it('B10091 grants Assault continuously but has no action-cancellation effect when its count later falls', () => {
    expect(B10091.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'continuous', scope: 'on-scene', continuousModifier: { grantKeywords: expect.any(Function) },
    });
  });

  it('B10091 queues its mandatory end-step bottom-deck effect from the entry-history flag', () => {
    expect(B10091.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' },
      condition: { kind: 'charTurnEffect', key: 'enteredByCutinEffectThisTurn' },
      effect: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'self', max: 1, pos: 'bottom' } },
    });
  });

  it('B10093 gives its selected hand reveal only presentation lifetime before drawing', () => {
    expect(B10093.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'handReveal', args: { player: 'self', audience: 'all', lifetime: 'presentation', max: 1 } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ] },
    });
  });
});
