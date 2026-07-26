import { describe, expect, it } from 'vitest';
import { B10001, B10001P } from '@/cards/ct-p10/B10001';
import { B10002, B10002P } from '@/cards/ct-p10/B10002';

describe('B10001 standard partner actions marker', () => {
  it('keeps common assist/solve actions out of CardDef abilities', () => {
    expect(B10001).toMatchObject({ kind: 'partner', standardPartnerActions: true, abilities: [] });
    expect(B10001P).toMatchObject({ kind: 'partner', standardPartnerActions: true, abilities: [] });
    expect(B10002).toMatchObject({ kind: 'partner', standardPartnerActions: true, abilities: [] });
    expect(B10002P).toMatchObject({ kind: 'partner', standardPartnerActions: true, abilities: [] });
  });
});
