## QA Wave 30 — deck-look zero-choice verification

- Added public-runtime witnesses for seventeen deck-look abilities that permit selecting up to one matching card.
- Proved an eligible match may be declined, no card enters hand, and every mandatory bottom/remove continuation completes.
- Covered real enter, declared, partner-enter, leave, and phase-end routes with costs, conditions, and authority cleanup.
- Fixed B10068/B10101 hidden-information leakage: look windows stay private, only a selected card is public, and decline publishes nothing.
- Advanced exact official-QA coverage from 1,158 to 1,175 matched records.
