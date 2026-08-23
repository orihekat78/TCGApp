# Next Task: QA adjudication Wave52 selection

Resume `qa/adjudication-wave-20260814-13` after the Waves50-51 commit.

## Completed

- Wave50 certifies ten stacked-versus-set records.
- Wave51 certifies ten refresh-timing records, including B08050 recertification.
- BUG-333/334 fix descriptor checkpoints, decline, and end-turn continuation.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` remain protected.

## Start Wave52

1. Confirm branch, HEAD, upstream, and protected status read-only.
2. Ground exact candidate:
   - question `2aa7bfa682907fcb41fe1039b77a1bb723458d7f54b272e8e75058a5e2ff943a`
   - answer `18ed0c93472b7b370de36474781dc98cb78137a0733cf4c3d679e1be519899ee`
   - exact ruling: a character entered by an ability/effect resolves its normal
     enter ability.
3. Twenty current records:
   `B03062,B04090,B05015,B05077,B06012,B06046,B06047,B06087,B08076,
   B08083,B09007,B09056,B09106,B10023,B10095,D10023,PR173,PR280,PR291,PR297`.
4. Split direct enter effects from hirameki, end-phase, choice/grant, declared,
   and Bond routes before certification. Do not reuse generic Wave31 evidence
   without a card-bound source→enter→trigger assertion.
5. Secondary coherent candidate if the 20-card group is too mixed:
   - question `a0f512e63a35b3d11f3cce14b2f8f753b7cd6951e4eac6237386abb7a2c72418`
   - answer `dbbcc5c6f78482d0c89f56018ca32bf80a619f259353e590b01cdc6f62f532b8`
   - nine declared abilities require two face-down evidence; one is insufficient.
6. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves50-51.md`
- `.claude/bugs/BUG-333.md`
- `.claude/bugs/BUG-334.md`

Remaining estimate: about 1,623 records, roughly 140-300 agent hours. Route
grouping and horizontal fixes may reduce it.
