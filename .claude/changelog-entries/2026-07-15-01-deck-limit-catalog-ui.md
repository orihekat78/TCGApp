## Deck limits, catalog image, and deck editor UX (2026-07-15)

### Fixed

- PR158/PR164 now honor the printed unlimited deck-construction rule. Engine,
  meta validation, and the editor share per-card limits and combine parallel
  printings by official card ID.
- D09014 now uses its authoritative image filename instead of falling back to
  the black placeholder.
- Built-in CT-D08/CT-D11 and AI/smoke fixtures are legal 40-card decks under
  official-ID copy limits.

### Added

- Right-click enlargement in the deck editor for deck, pool, partner, case,
  and partner/case picker cards.
- Three validated manual-test decks cover the green bug wave, contact/AP, and
  unlimited ID 0627. Existing user decks remain unchanged.

### Verification

- 5,786 Vitest tests, 13 targeted meta Playwright tests, typecheck, lint,
  BUG/listener/side-channel/docs checks, meta build, smoke 1000, and benchmark
  passed. Full 1,145-card catalog scroll had no placeholder or console error.
