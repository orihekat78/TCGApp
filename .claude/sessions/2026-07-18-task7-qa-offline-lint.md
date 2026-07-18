# Task 7 — Q&A offline lint

- Added `lint:qa`: tracked snapshot/status/manifest and hash-only baseline only; no official Q&A bodies or network.
- Approved baseline: 2,650 items; normal lint permits current legacy-unreviewed state, `--require-all` fails until full coverage.
- PR CI runs offline lint with `contents: read`; scheduled/manual status workflow reads the official API and compares 2,240 printings plus card-number hash without writes or secrets.
- Verified focused tests, typecheck, ESLint, generated docs, offline guard, and one live status read (`2240`, hash matched).
- Full `npm test` exceeded the local 120-second command timeout without test failure output.
