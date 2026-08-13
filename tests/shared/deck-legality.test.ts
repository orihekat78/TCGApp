import { describe, expect, it } from 'vitest';
import { validateDeckLegality, type DeckCardResolver, type DeckInput } from '../../src/shared/deck-legality';

const input = (overrides: Partial<DeckInput> = {}): DeckInput => ({
  partner: 'partner',
  case: 'case',
  main: [{ printingId: 'char', count: 40 }],
  ...overrides,
});

const resolve: DeckCardResolver = (printingId) => ({
  partner: { printingId, officialId: 'partner', kind: 'partner', deckLimit: 3 },
  case: { printingId, officialId: 'case', kind: 'case', deckLimit: 3 },
  char: { printingId, officialId: 'char', kind: 'character', deckLimit: 'unlimited' },
  event: { printingId, officialId: 'event', kind: 'event', deckLimit: 3 },
  copyA: { printingId, officialId: 'same', kind: 'character', deckLimit: 3 },
  copyB: { printingId, officialId: 'same', kind: 'character', deckLimit: 3 },
  restricted: { printingId, officialId: '0002', kind: 'character', deckLimit: 3 },
  forbidden: { printingId, officialId: '0208', kind: 'character', deckLimit: 3 },
  prohibited0050: { printingId, officialId: '0050', kind: 'character', deckLimit: 3 },
  restricted0624: { printingId, officialId: '0624', kind: 'character', deckLimit: 3 },
  specialCase: { printingId, officialId: '0407', kind: 'case', deckLimit: 3 },
  mismatch: { printingId, officialId: 'same', kind: 'event', deckLimit: 3 },
  mismatchLimit: { printingId, officialId: 'same', kind: 'character', deckLimit: 2 },
  spoof: { printingId: 'other-printing', officialId: 'spoof', kind: 'character', deckLimit: 'unlimited' },
}[printingId]);

describe('deck legality', () => {
  it('fails closed for unknown required slots and main printings', () => {
    const result = validateDeckLegality(input({ partner: 'unknown', case: '', main: [{ printingId: 'missing', count: 40 }] }), resolve);

    expect(result.errors).toEqual(expect.arrayContaining([
      'PARTNER_UNKNOWN', 'CASE_MISSING', 'MAIN_UNKNOWN',
    ]));
    expect(result.ok).toBe(false);
  });

  it('fails closed when the resolver does not identify the requested printing', () => {
    const result = validateDeckLegality(input({ main: [{ printingId: 'spoof', count: 40 }] }), resolve);

    expect(result.errors).toContain('MAIN_UNKNOWN');
    expect(result.ok).toBe(false);
  });

  it('requires partner and case slots, plus character or event cards only in main', () => {
    const result = validateDeckLegality(input({
      partner: 'char',
      case: 'partner',
      main: [{ printingId: 'partner', count: 20 }, { printingId: 'case', count: 20 }],
    }), resolve);

    expect(result.errors).toEqual(expect.arrayContaining([
      'PARTNER_KIND', 'CASE_KIND', 'MAIN_KIND',
    ]));
  });

  it('rejects non-safe main entry counts and a non-40 total', () => {
    const result = validateDeckLegality(input({ main: [{ printingId: 'char', count: 39.5 }] }), resolve);

    expect(result.errors).toEqual(expect.arrayContaining(['MAIN_ENTRY_COUNT', 'MAIN_COUNT']));
  });

  it('aggregates printings by official ID before applying their copy limit', () => {
    const result = validateDeckLegality(input({
      main: [
        { printingId: 'copyA', count: 3 },
        { printingId: 'copyB', count: 3 },
        { printingId: 'char', count: 34 },
      ],
    }), resolve);

    expect(result.errors).toContain('COPY_LIMIT');
  });

  it('rejects metadata conflicts for variants of the same official card ID', () => {
    const result = validateDeckLegality(input({
      main: [
        { printingId: 'copyA', count: 3 },
        { printingId: 'mismatch', count: 3 },
        { printingId: 'char', count: 34 },
      ],
    }), resolve);

    expect(result.errors).toContain('CARD_METADATA_CONFLICT');
  });

  it('rejects conflicting copy-limit metadata for variants of the same official card ID', () => {
    const result = validateDeckLegality(input({
      main: [
        { printingId: 'copyA', count: 3 },
        { printingId: 'mismatchLimit', count: 3 },
        { printingId: 'char', count: 34 },
      ],
    }), resolve);

    expect(result.errors).toContain('CARD_METADATA_CONFLICT');
  });

  it('keeps all competitive card restrictions as nonblocking warnings', () => {
    const result = validateDeckLegality(input({
      main: [
        { printingId: 'forbidden', count: 1 },
        { printingId: 'prohibited0050', count: 1 },
        { printingId: 'restricted', count: 1 },
        { printingId: 'restricted0624', count: 1 },
        { printingId: 'char', count: 36 },
      ],
    }), resolve);

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'COMPETITIVE_PROHIBITED:0208',
      'COMPETITIVE_PROHIBITED:0050',
      'COMPETITIVE_RESTRICTED:0002',
      'COMPETITIVE_RESTRICTED:0624',
    ]));
  });

  it('keeps the event-only competitive case restriction nonblocking', () => {
    const result = validateDeckLegality(input({ case: 'specialCase' }), resolve);

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('COMPETITIVE_CASE_EVENT_ONLY:0407');
  });
});
