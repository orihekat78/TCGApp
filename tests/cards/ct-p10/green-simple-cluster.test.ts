import { describe, expect, it } from 'vitest';

import { B10035 } from '@/cards/ct-p10/B10035';
import { B10049 } from '@/cards/ct-p10/B10049';
import { B10062Sec1, B10062Sec2 } from '@/cards/ct-p10/B10062';
import { B10063 } from '@/cards/ct-p10/B10063';
import { B10064 } from '@/cards/ct-p10/B10064';
import { B10040 } from '@/cards/ct-p10/B10040';
import { B10043 } from '@/cards/ct-p10/B10043';
import { B10044 } from '@/cards/ct-p10/B10044';
import { B10045 } from '@/cards/ct-p10/B10045';
import { B10059 } from '@/cards/ct-p10/B10059';

describe('CT-P10 standard partners', () => {
  it('keeps the five printed standard partner cards as partner metadata', () => {
    expect(B10035).toMatchObject({ id: 'B10035', kind: 'partner', names: ['京極真'], colors: ['白'], lp: 1 });
    expect(B10049).toMatchObject({ id: 'B10049', kind: 'partner', names: ['新出智明'], colors: ['赤'], lp: 1 });
    expect(B10062Sec1).toMatchObject({ id: 'B10062Sec1', kind: 'partner', names: ['松田陣平'], colors: ['黄'], lp: 1 });
    expect(B10062Sec2).toMatchObject({ id: 'B10062Sec2', kind: 'partner', names: ['松田陣平'], colors: ['黄'], lp: 1 });
    expect(B10063).toMatchObject({ id: 'B10063', kind: 'partner', names: ['萩原研二'], colors: ['黄'], lp: 1 });
    expect(B10064).toMatchObject({ id: 'B10064', kind: 'partner', names: ['伊達航'], colors: ['黄'], lp: 1 });
  });

  it('does not invent unimplemented partner ability descriptors', () => {
    for (const card of [B10035, B10049, B10062Sec1, B10062Sec2, B10063, B10064]) {
      expect(card.abilities).toEqual([]);
    }
  });
});

describe('CT-P10 existing-DSL character cluster', () => {
  it('uses the canonical hooks and modifiers for each printed clause', () => {
    expect(B10040.abilities).toHaveLength(2);
    expect(B10043.abilities[0]).toMatchObject({ type: 'continuous', continuousModifier: { lpDelta: 1 } });
    expect(B10044.abilities[2]).toMatchObject({ type: 'icon-disguise', condition: { kind: 'and' } });
    expect(B10045.abilities[1]).toMatchObject({ trigger: { hook: 'phase:end:start' } });
    expect(B10059.abilities[0]).toMatchObject({ type: 'continuous', continuousModifier: { lvlDelta: 5 } });
  });
});
