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

## Privacy

- Never copy raw question or answer bodies, individual official URLs, or local
  raw-package paths into shards, tests, logs, generated docs, or review notes.
- Share Q&A identity through `qaId`, card IDs, hashes, and controlled evidence
  references only.
