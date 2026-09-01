# Next Task: card-completion QA Wave195

Resume `qa/adjudication-wave-20260814-13` after the Wave193-194 commit.

## Runtime and cadence

- Use actual `gpt-5.6-terra` / `high`; confirm session metadata, not config.
- Complete Waves195-196 only. Do not begin Wave197.
- Certification-only work uses no agent. Production gap requires a failing probe.
- One focused type/lint/QA/docs gate after Wave196; one commit and push.
- Broad gate remains Wave200 unless engine, state, resolver, security, save, or visible UI changes.

## Coverage and protection

- Wave193-194 target rows are adjudicated. Preserve unrelated dirty/untracked
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `tests/cards/ct-p10/B10006.test.ts`.
- Local raw `ct-d01-api.json` drift remains out of scope.
- Normalized Q&A SHA-256:
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P09 character TSV SHA-256:
  `34f2babbaaf07cef0f19ff7a765ca7052262d7c43637230b606b14306ff20c04`.

## Wave195 candidates

- `B09092 70f5af4b948092f863f1b2d28f8c91c4016f93c53f89de134024bbd39068daa3`
- `B09093 c5e5dfbc5f228baa2e8456d556f8e0c51ee6af40acbfa37469da20356b5c7ad8`
- `B09093 c81ed2b96b74a7195fd0af27c74fbaaf1ca39451fad6595923353a24a32fbc98`
- `B09093 dbb9809c88559fd14fec1cb2ac25273aeb5c690cf759286cb43a3b84e6387e3c`
- `B09094 88ce7c7971391a7b00c6d94931dab0231da2abf295066c75da6122dd279cc728`
- `B09094 f805102c1ace6c8225bf996e69c2966354e98b388e1efaba09ecd4b0a16d4885`
- `B09095 cb48ad5742f63c2a3b6c5b048905bade78ab9cec63501a1ce37450092eb0d7af`
- `B09096 aed9fa2aadf694d4b830c3df8fe97d3324f2ece2e72a125fb2eee167d1badc6`
