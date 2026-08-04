import { describe, expect, it } from 'vitest';
import * as cardImage from '@/ui/services/cardImage';

describe('cardImage service', () => {
  it('exports only the deterministic data URI placeholder', () => {
    expect(Object.keys(cardImage)).toEqual(['getCardImagePlaceholder']);

    const placeholder = cardImage.getCardImagePlaceholder();
    expect(placeholder).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(placeholder)).toContain('<svg');
  });
});
