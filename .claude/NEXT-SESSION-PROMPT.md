# Next Task: card-completion QA Waves195-196

Resume `qa/adjudication-wave-20260814-13` after the Wave193-194 commit.

## Runtime and cadence

- Use actual `gpt-5.6-terra` / `high`; confirm session metadata, not config.
- **Waves195-196 are one fixed, uninterrupted pair in this task.** Finish both
  before any gate, commit, or stop. Do not stop after Wave195. Do not begin
  Wave197.
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

## Wave196 candidates

- `B09097 0237a0c142d5e7feca1b4e4a9e92d3bf06f73c90344a81fa1ae51d869726b9b3`
- `B09097 b7713abe7876ef1ad566c125fa172a4f2a13b192f2b22a4a2cea136020526dac`
- `B09101 e4bfd093e51f7de5f557e06b272adb54e6d73f1329c7ee205a9406d7f885cd01`
- `B09102 2c4400fb754558e01719a011fef8dd61a940683187cb23450c6aef9de67b3131`
- `B09102 58e653d9c49856dc9de4392d6e300c58ecfbd1f8a97358141cef1a2af866c307`
- `B09103 2d507903ab36126f938c276a8a8c062abb57b56f33145ef337d80dedb53883ce`
- `B09103 c5e5dfbc5f228baa2e8456d556f8e0c51ee6af40acbfa37469da20356b5c7ad8`
- `B09104 2ff985085270588f156ddf5ca26bf7b0a1b52d2f4f81c92ef94584017075c82a`
