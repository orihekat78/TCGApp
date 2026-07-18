# cards-data — local official-card cache

The local cache is derived from the official Detective Conan TCG card API.
It supports compiler and grounding work; it is not application content.

## Tracked verification metadata

[status.json](status.json) is the authoritative tracked snapshot. It contains
only source URL/time, package and kind counts, card-number hashes, a normalized
FAQ-metadata hash, and duplicate results—never official card text or images.

Read `status.json` for the current snapshot. Do not copy its counts into docs.

## Local-only inputs

The following are intentionally ignored and must never be staged:

- `_raw/<package>-api.json` — official API response cache
- `<package>/<kind>.tsv` — regenerated local TSV corpus

## Refresh and verify

```sh
npm run cards:fetch
npm run cards:status -- --fetched-at 2026-07-18T00:00:00.000Z
npx vitest run tests/compiler/cards-data-consistency.test.ts
```

`cards:fetch` fetches every API page and regenerates TSV files. `cards:status`
validates raw/TSV card-number equality, package and kind counts, and duplicate
card numbers before writing the tracked metadata snapshot. Give it the UTC time
of the successful fetch.

The API's card-list HTML can lag behind the API itself. The API is the source
for this cache.

## Layout

```text
cards-data/
├── INDEX.md
├── packages.md
├── status.json
├── _regen_all.cjs
├── _raw/                 # ignored
└── ct-*/ and pr-*/       # ignored TSV directories
```

## TSV kinds

`partner`, `character`, `event`, and `case` are regenerated from official API
types. See [packages.md](packages.md) for stable package IDs and the status
snapshot for counts.

## Related

- [packages.md](packages.md)
- [status.json](status.json)
- [cards analysis](../cards-analysis/INDEX.md)
- [engine card shape](../engine-api-card-shape.md)
