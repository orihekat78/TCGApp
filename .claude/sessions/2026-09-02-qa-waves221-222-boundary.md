# QA Waves221-222 boundary

- Selected all 43 remaining CT-P02 `test-missing` Q&A rows from the pinned
  snapshot. This is a new explicit boundary, not an inferred prefix.
- Snapshot order is preserved and cards are atomic: Wave221 has B02002-B02050
  (23 rows); Wave222 has B02051-B02087 (20 rows).
- The canonical `qaId` lists and authority pin are in `NEXT-SESSION-PROMPT.md`.
- No card was grounded and no adjudication shard, production, or generated file
  was changed. Broad Vitest remains unresolved (`CARDS_DATA_BUSY` and release
  failures).
