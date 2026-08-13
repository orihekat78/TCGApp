export type DeckCardKind = 'character' | 'event' | 'partner' | 'case';

export type DeckInput = {
  partner: string;
  case: string;
  main: readonly { printingId: string; count: number }[];
};

export type ResolvedDeckCard = {
  printingId: string;
  officialId: string;
  kind: DeckCardKind;
  deckLimit: number | 'unlimited';
};

export type DeckCardResolver = (printingId: string) => ResolvedDeckCard | undefined;

export type DeckLegalityError =
  | 'PARTNER_MISSING' | 'PARTNER_UNKNOWN' | 'PARTNER_KIND'
  | 'CASE_MISSING' | 'CASE_UNKNOWN' | 'CASE_KIND'
  | 'MAIN_COUNT' | 'MAIN_ENTRY_COUNT' | 'MAIN_UNKNOWN' | 'MAIN_KIND'
  | 'CARD_METADATA_CONFLICT' | 'COPY_LIMIT';

export type DeckLegalityWarning =
  | `COMPETITIVE_PROHIBITED:${string}`
  | `COMPETITIVE_RESTRICTED:${string}`
  | `COMPETITIVE_CASE_EVENT_ONLY:${string}`;

export type DeckLegalityResult = {
  ok: boolean;
  errors: DeckLegalityError[];
  warnings: DeckLegalityWarning[];
};

const MAIN_DECK_SIZE = 40;
const DEFAULT_DECK_LIMIT = 3;
const COMPETITIVE_PROHIBITED = new Set(['0208', '0050']);
const COMPETITIVE_RESTRICTED = new Set(['0002', '0624']);
const EVENT_ONLY_CASE = '0407';

function addOnce<T>(items: T[], item: T): void {
  if (!items.includes(item)) items.push(item);
}

function hasValidCardMetadata(
  card: ResolvedDeckCard | undefined,
  printingId: string,
): card is ResolvedDeckCard {
  return Boolean(
    card
    && card.printingId === printingId
    && card.officialId
    && (card.kind === 'character' || card.kind === 'event' || card.kind === 'partner' || card.kind === 'case')
    && (card.deckLimit === 'unlimited' || (Number.isSafeInteger(card.deckLimit) && card.deckLimit >= 1)),
  );
}

/**
 * Rules/02 structural deck validation, independent of card catalog ownership.
 * Tournament/card-restriction notices are deliberately warnings: local casual
 * play remains available while the editor makes the restriction visible.
 */
export function validateDeckLegality(input: DeckInput, resolve: DeckCardResolver): DeckLegalityResult {
  const errors: DeckLegalityError[] = [];
  const warnings: DeckLegalityWarning[] = [];
  const partner = typeof input?.partner === 'string' ? input.partner : '';
  const caseId = typeof input?.case === 'string' ? input.case : '';
  const main = Array.isArray(input?.main) ? input.main : [];

  const validateSlot = (
    printingId: string,
    wanted: 'partner' | 'case',
    missing: DeckLegalityError,
    unknown: DeckLegalityError,
    wrongKind: DeckLegalityError,
  ): ResolvedDeckCard | undefined => {
    if (!printingId) {
      addOnce(errors, missing);
      return undefined;
    }
    const card = resolve(printingId);
    if (!hasValidCardMetadata(card, printingId)) {
      addOnce(errors, unknown);
      return undefined;
    }
    if (card.kind !== wanted) addOnce(errors, wrongKind);
    return card;
  };

  validateSlot(partner, 'partner', 'PARTNER_MISSING', 'PARTNER_UNKNOWN', 'PARTNER_KIND');
  const caseCard = validateSlot(caseId, 'case', 'CASE_MISSING', 'CASE_UNKNOWN', 'CASE_KIND');
  if (caseCard?.officialId === EVENT_ONLY_CASE) {
    addOnce(warnings, `COMPETITIVE_CASE_EVENT_ONLY:${EVENT_ONLY_CASE}`);
  }

  const grouped = new Map<string, { total: number; kinds: Set<DeckCardKind>; limits: Set<number | 'unlimited'> }>();
  let total = 0;
  for (const entry of main) {
    const count = entry?.count;
    if (!Number.isSafeInteger(count) || count < 1) {
      addOnce(errors, 'MAIN_ENTRY_COUNT');
      continue;
    }
    total += count;
    const printingId = typeof entry?.printingId === 'string' ? entry.printingId : '';
    const card = printingId ? resolve(printingId) : undefined;
    if (!hasValidCardMetadata(card, printingId)) {
      addOnce(errors, 'MAIN_UNKNOWN');
      continue;
    }
    if (card.kind !== 'character' && card.kind !== 'event') addOnce(errors, 'MAIN_KIND');
    const group = grouped.get(card.officialId) ?? { total: 0, kinds: new Set(), limits: new Set() };
    group.total += count;
    group.kinds.add(card.kind);
    group.limits.add(card.deckLimit);
    grouped.set(card.officialId, group);
  }
  if (total !== MAIN_DECK_SIZE) addOnce(errors, 'MAIN_COUNT');

  for (const [officialId, group] of grouped) {
    if (COMPETITIVE_PROHIBITED.has(officialId)) {
      addOnce(warnings, `COMPETITIVE_PROHIBITED:${officialId}`);
    }
    if (COMPETITIVE_RESTRICTED.has(officialId)) {
      addOnce(warnings, `COMPETITIVE_RESTRICTED:${officialId}`);
    }
    if (group.kinds.size !== 1 || group.limits.size !== 1) {
      addOnce(errors, 'CARD_METADATA_CONFLICT');
      continue;
    }
    const [limit] = group.limits;
    if (limit !== 'unlimited' && group.total > limit) addOnce(errors, 'COPY_LIMIT');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export { DEFAULT_DECK_LIMIT };
