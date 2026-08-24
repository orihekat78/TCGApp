# Q&A Adjudication Queue Workflow

Run `npm run qa:adjudication:queue` for deterministic, hash-only work
allocation. It is read-only: it reads the tracked snapshot and shards and
does not access ignored raw Q&A packages.

## Ownership

- One worker is the exclusive writer for one shard: `qa-adjudication/<hex>.json`.
- A worker may edit only its assigned shard and its directly required source or
  test files. It must not edit another shard, the manifest, a baseline, or
  generated documentation.
- The coordinator alone runs generated-documentation and baseline updates, then
  validates merged shards.

## Adjudication

- Use only existing, controlled evidence references. Do not guess an
  implementation or infer a ruling from absent evidence.
- `groupEquivalentEligible` is only a queue candidate. Apply it only after the
  exact section/question/answer group is verified and every member is in the
  assigned shard.
- Preserve canonical item and evidence ordering. Run `npm run qa:adjudication:merge`
  and `npm run lint:qa` before handoff.

## Execution cadence

- Batch ordinary T1/T2 items by shared rule primitive, not one exact Q&A group
  per implementation wave. Target 20-30 aligned items per wave; keep unrelated
  semantics in separate matrices.
- Use smaller 5-15 item waves when public decisions, save hydration, card
  interactions, or new fixture shapes need individual judgment. Isolate T3
  engine/resolver/GameState defects as their own wave.
- Every ordinary wave runs focused tests, both typechecks, focused ESLint,
  adjudication merge/lint, generated-Q&A check, and diff-check.
- Run full Vitest, full ESLint, smoke, and Playwright once per ten waves, and
  immediately for T3 engine/security/save/public-UI changes or publication.
- Do not repeat a green unchanged gate inside one checkpoint. Commit and push
  after two implementation waves under the repository context limit.

## Privacy

- Never copy raw question or answer bodies, individual official URLs, or local
  raw-package paths into shards, tests, logs, generated docs, or review notes.
- Share Q&A identity through `qaId`, card IDs, hashes, and controlled evidence
  references only.
