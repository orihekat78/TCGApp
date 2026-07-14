import { describe, expect, it } from 'vitest';
import { B09052 } from '@/cards/ct-p09/B09052';
import { B09052P } from '@/cards/ct-p09/B09052P';

describe('B09052 / B09052P', () => {
  it('draws, enters an eligible white character, then may copy another scene name', () => {
    const effect = B09052.abilities[0]?.effect;
    expect(effect).toMatchObject({ kind: 'sequence' });
    expect(JSON.stringify(effect)).toContain('excludeBound');
    expect(JSON.stringify(effect)).toContain('$entered');
  });

  it('has the declared-name contact cutin and identical base/P rules text', () => {
    const cutin = B09052.abilities[1];
    expect(cutin).toMatchObject({
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', selfOnly: true },
      effect: { kind: 'sequence' },
    });
    expect(JSON.stringify({ ...B09052, id: '', no: '', rarity: '', imageUrl: '' }))
      .toBe(JSON.stringify({ ...B09052P, id: '', no: '', rarity: '', imageUrl: '' }));
  });
});
