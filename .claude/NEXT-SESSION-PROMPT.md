# Next Task: card-completion QA Waves164-165

Resume `qa/adjudication-wave-20260814-13` after the Waves162-163 commit.

## Completed

- Waves162-163 align fourteen CT-P06/CT-D11 items. Coverage is 1928 matched /
  1036 test-missing / 2964 total; 919 exact groups remain, including 802 singletons.
- B06091/D11016 now follow official selected-target guard semantics; BUG-097 is
  corrected. B06092-B06109 remaining CT-P06 rulings have public proof.
- Target/legacy 63 and focused horizontal 328 tests pass. Full gates remain
  carried from Wave161 under the ten-wave cadence.

## Cadence

- Ground complete cards; keep unrelated semantics in separate matrices.
- Per wave: fresh authority, public proof, narrow QA merge.
- Per two waves: type/focused lint/QA/docs/diff, one commit, one push.
- Do not repeat full Vitest/ESLint/smoke/Playwright before Wave170 unless a
  T3/security/save/public-UI change requires it.
- Certification-only work uses no agents. Production/T3 may use at most three
  read-only reviewers.

## Start

1. Read root/cards/tests/.claude AGENTS, conan-router, card-wave, conan-verify.
2. Verify branch, HEAD/upstream, status, and protected pnpm files read-only.
3. Read the Waves162-163 session record, this prompt, and QA workflow.
4. Re-run hash-only queue and fresh isolated authority validation.
5. Ground every physical printing before certification or repair.

## Wave164: B07001/P/P2, B07003/P, B07004/P (10 items)

- B07001 targets:
  - `9008e450155fd9d8c51c93ed1ce6e7747a6d956514d5141c12b9e1499dee91e9`:
    one dual-trait card contributes only one AP+1000 unit.
  - `3ba2c681a2b0b87e9836fd9d8ac464dfbef5f7fae479ef7c2910bc6cd18acbcc`:
    Assault is granted even when the cost removes zero matching cards.
  - `80a2cfb16a87e5d0d4da8698cb86f47b173740616dd1af4e02537a5deb1ade52`:
    the second declaration may select its own scene occurrence.
  - `934608b55c1b640bd5e5c1bf6dc33c3322750bdefd79b0a5e162289b809c3ad0`:
    active-target permission does not bypass a same-turn named-state ban.
- B07003 targets:
  - `accf47f82e87c381577a50c21051cd8f4c040da9bf67cf224d7ccb3cd83252bd`:
    a dynamically granted Cut-In resolves normally and the used card is removed.
  - `cdeced21ac31590728e947e8ac9d755b7698532e0bb7eb83f3f288dc594464f8`:
    the remove-area follow-up cannot be selected when the scene choice is zero.
- B07004 targets:
  - `0e8778bc75d72ebcd73bd21c7d81f547b11128d056f64b4457e321f5a1653fdf`:
    declaration remains usable with zero hand cards.
  - `657dafe95083ad08981b7610e34d651ff4ade221a78bb2a0482884c4475c0ff7`:
    short-deck look/entry refresh timing follows the official sequence.
  - `39774252ce93608575bcdb0a9138a8f6a2bcb44398c14e54541738e77e7cc14f`:
    a valid looked-at character may still be declined.
  - `8c84ca4d897db6486c7b8176227093bbd708fb8bdf1e8ebd742838f8f43802c8`:
    full-scene switch may remove B07004 itself and still resolves hand discard
    before the entrant's pending enter ability.

## Wave165: B07005, B07008, B07009/P, B07010-B07012/P, B07015/P (9 items)

- B07005 `c596ae62d295a0df22c230a2cbc61a4567f85c825a50fd331245bee0fa8fa94c`:
  its contact bans Cut-In only; Disguise remains legal.
- B07008 targets `cb48ad5742f63c2a3b6c5b048905bade78ab9cec63501a1ce37450092eb0d7af`
  and `241b02bbb7a8197710e7c0ed17093c02e009cea693fa3391d4e1fa3577457fe1`:
  hand-only level reduction resets to printed level on scene; Next Hint from
  FILE5 leaves FILE4, so the FILE5 enter ability is inactive.
- B07009/P `684d62441f6ae3dcf940ea71c84bb30e59e92ef6cbe04ac02ddbeacb5aec06d6`:
  nonqualifying Cut-In remains legal for AP+1000 and draws nothing.
- B07010 `3c5311bf5b7b3ddb55695107de7b3e7ac562b49df49486020cbf2f14f49f4137`:
  short-deck look/remainder refresh timing is exact.
- B07011 `1c10b9e97107208c6fd31174fe5b3b8f52f89fc789fee528f6ffc2b2a8aef5c7`:
  tied rock-paper-scissors repeats until a winner exists.
- B07012/P `13f7236b17a7c3f7577c4e42cab42556ddb14ba5f6edf1dfaf0192479bb325ed`:
  switching out the last nonblue character is simultaneous with entry, so the
  later enter-condition sees no nonblue character.
- B07015/P targets `6717248f8a1ed1d34006e53d306840354235151597ab416af3b9a421f8603070`
  and `2f7dc2557c5ec988da3b2e72a18d5c685ca1a99b820578d15180b3a4021a1072`:
  owner chooses order against the entrant's enter effect; short-deck reveal
  refreshes only after remainder removal.

## Carry-forward

- Fresh authority: 2257 raw/TSV, 2964 Q&A/conflict zero; normalized hash
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P07 TSV SHAs: partner `d2a8214df160cb453ee91a46fa387aa6681f6fcba6a8765c3d9109ad7cd0d834`;
  character `d53cafbfcc4415940f6e8879c1cc51633b1644924b0492fdb25484d11c7e3019`;
  event `c2d8fdae4b16dbd3963a7e6a1100f17e7ed0625ba424d4fbf871abab9e3dd4a9`;
  case `9561a30d3f53cadaa5aeb5460c7e1d83367e07ab174b122df83db6b3b34df996`.
- B07001/B07003/B07008/B07011 have stale historical DEFER notes; trust current
  CardDefs/capabilities and reproduce before deciding repair or deferral.
- PR322/live Q&A drift remains separate. Preserve the two untracked pnpm files.
- Forecast: roughly 30-70 waves; 50-110 working hours, center about 80.
