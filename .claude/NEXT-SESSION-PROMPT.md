# Next Task: card-completion QA Waves162-163

Resume `qa/adjudication-wave-20260814-13` after the Waves160-161 commit.

## Completed

- Wave160 certifies B06060/B06067/P/B06071/P/B06072/P across repeat actions,
  mandatory multi-observers, named-state restrictions, non-targeting stun,
  color-ignore use, and sequential remove-count branches.
- Wave161 certifies B06076/B06077/P/B06085/P/B06086/P across declared timing,
  action-end source presence, evidence/MR movement, and pre-guard flips.
- B06076's omitted declared ability is repaired. The shipped a1/a2 physical
  indices remain 0/1; appended a3 uses index 2 for old-save/replay safety.
- Coverage is 1914 matched / 1050 test-missing / 2964 total. Remaining exact
  groups are 931, including 812 singleton groups.

## Throughput and gates

- Batch complete cards; keep unrelated semantics in separate matrices.
- Per wave: fresh grounding, public proof, narrow QA merge.
- Per two waves: type/lint/QA/docs/diff, one commit, one push.
- Full Vitest/ESLint/smoke/Playwright ran at Wave161. Do not repeat before
  Wave170 unless a T3/security/save/public-UI change requires it.
- Certification-only work uses no agents. Production/T3 may use at most three
  read-only reviewers.

## Start

1. Read root/cards/tests/.claude AGENTS, conan-router, card-wave, conan-verify.
2. Verify branch, HEAD/upstream, status, and protected pnpm files read-only.
3. Read the Waves160-161 session record, this prompt, and QA workflow.
4. Re-run the hash-only queue and a fresh isolated authority validation.
5. Ground every physical printing before certification or repair.

## Wave162: six CT-P06 items

- B06091 `100adbbed925b66fdcb792ff3aa4a483640f287338264fc5c064d46af6177788`:
  certify its observer does not fire when B06091 itself guards an action that
  selected another character or incident.
- B06092 `b190d782f194602ebcc5f5fd6d94ccd7e5927e1acc2a87517b2038e4bbfcec6c`:
  certify Cut-In remains legal on a non-Poirot character, grants AP+1000, and
  draws no card.
- B06093 `fd663a129833b5aca7792e25753f35394f7af3f2f622b2954c7aaf38224ce727`:
  certify multiple active Misread bearers may apply to one reasoning action.
- B06095/P `125282ef42997636595e79840f9671009a309cc99d36b0f0da406e3de9b044e4`:
  certify the turn trait grant covers character cards in all eight defined
  areas while excluding non-characters and the opponent.
- B06098/P targets `78b84cb792d3783cc2b18d867f6652c605ce2650a2a6e5732aafea92c999e37f`
  and `85038b630222e1a06910714245cc1b0963194173e2ed898fd0916ce95e7d3845`:
  certify the source counts itself toward two Organization characters only
  while on scene; its partner-area occurrence does not satisfy that count.

## Wave163: seven CT-P06 items

- B06103/P targets `06421f8b3e73fe7e22aaac43188049be0f09de4bd944b4069b0a1c84ffcd7102`,
  `39f1c14b17c896de002441eedc381447fd981ccfbc3a113402954cf4b89f23d2`,
  `dae02fc940ddff850db5b2535ec40ecb446e33833474a6114667f1fd14600790`:
  certify the Gin use/entry ban across hand, Next Hint, and effect entry;
  declaration remains usable while its enter step is suppressed, Cut-In and
  Hirameki stay exempt, and the turn ban survives source departure.
- B06105/P targets `cef19acafddb85d5e9ebc2616e6fb4f08209d73a51409805a085cd196de080e5`
  and `ef8f1c5c8c1abdc6f70dd0cbdf073b3d8c558f5feeca4c12d99122b337875843`:
  certify arbitrary exact-three own evidence payment and mandatory draw after
  an opposing level-6-or-lower discard.
- B06109/P targets `0344326f0d096542a20d08638ac7053181e88bdbe689d4c051caf0b6bac71225`
  and `d0d507837dc0c22afe4230aae4e7bc09551a213d037f02ea876c29a982a8b289`:
  certify hand/Next-Hint character restriction exceptions for effects, Cut-In,
  Disguise, Hirameki, and events, plus its green-and-white incident identity.

## Carry-forward

- Fresh authority: 2257 raw/TSV, 22 packages, duplicate 0, 2964 Q&A/conflict 0;
  normalized hash `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P06 character SHA is `15eab04615778f7ce4c436924e5a8966b91d2f19499cfad9c07de35191ba7bd7`;
  case SHA is `d8323f3f1948ca6ada5049cb7274c019c805242fcc5058b173ba9e85fcd112e6`.
- PR322 and the known live-sync Q&A drift remain separate. Do not absorb them.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Forecast: roughly 32-72 waves; 52-112 working hours, center about 82.
