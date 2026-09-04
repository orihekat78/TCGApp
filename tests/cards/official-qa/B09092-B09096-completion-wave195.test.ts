// qa: card:B09092:70f5af4b948092f863f1b2d28f8c91c4016f93c53f89de134024bbd39068daa3
// qa: card:B09093:c5e5dfbc5f228baa2e8456d556f8e0c51ee6af40acbfa37469da20356b5c7ad8
// qa: card:B09093:c81ed2b96b74a7195fd0af27c74fbaaf1ca39451fad6595923353a24a32fbc98
// qa: card:B09093:dbb9809c88559fd14fec1cb2ac25273aeb5c690cf759286cb43a3b84e6387e3c
// qa: card:B09094:88ce7c7971391a7b00c6d94931dab0231da2abf295066c75da6122dd279cc728
// qa: card:B09094:f805102c1ace6c8225bf996e69c2966354e98b388e1efaba09ecd4b0a16d4885
// qa: card:B09095:cb48ad5742f63c2a3b6c5b048905bade78ab9cec63501a1ce37450092eb0d7af
// qa: card:B09096:aed9fa2aadf694d4b830c3df8fe97d3324f2ece2e72a125fb2eee167d1badc6a

import { describe, expect, it } from 'vitest';
import { B09092 } from '@/cards/ct-p09/B09092';
import { B09093 } from '@/cards/ct-p09/B09093';
import { B09094 } from '@/cards/ct-p09/B09094';
import { B09095 } from '@/cards/ct-p09/B09095';
import { B09096 } from '@/cards/ct-p09/B09096';

describe('official QA Wave195: CT-P09 effect contracts', () => {
  it('keeps the fixed-count deck effects on their corresponding source abilities', () => {
    expect(B09092.abilities.find(ability => ability.id === 'a3')).toMatchObject({ effect: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 4 } } });
    expect(B09094.abilities.find(ability => ability.id === 'a3')).toMatchObject({ effect: { kind: 'conditional', then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } } } });
  });

  it('uses live continuous state and a one-time enter modifier for B09093', () => {
    expect(B09093.abilities.find(ability => ability.id === 'a2')).toMatchObject({ type: 'continuous', condition: { kind: 'and' }, continuousModifier: { apDelta: 2000 } });
    expect(B09093.abilities.find(ability => ability.id === 'a3')).toMatchObject({ type: 'triggered', effect: { kind: 'conditional', then: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, scope: 'turn' } } } });
  });

  it('keeps B09094 trace keyword state continuous and B09095 level state hand-only', () => {
    expect(B09094.abilities.find(ability => ability.id === 'a2')).toMatchObject({ type: 'continuous', continuousModifier: expect.any(Object) });
    expect(B09095.abilities.find(ability => ability.id === 'a1')).toMatchObject({ scope: 'on-hand', continuousModifier: { lvlDeltaInHand: -2 } });
  });

  it('resolves B09096 matching against the source effective AP at effect resolution', () => {
    expect(B09096.abilities.find(ability => ability.id === 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'sceneRemove', args: { filter: { apMin: { dyn: '$self.ap' }, apMax: { dyn: '$self.ap' } } } } });
  });
});
