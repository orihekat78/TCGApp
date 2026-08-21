# QA Wave 25 Immediate-Effect Public Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task.

**Goal:** Certify 27 test-missing official Q&A records for `B08058`, `B08081`, `B10071`, `B10087`, and `B10088` through public-dispatch witnesses, while fixing the two confirmed immediate-resolution defects.

**Architecture:** Keep card-specific text in CardDefs and repair shared engine contracts only where the same semantics apply horizontally. Effect entry from remove uses the existing two-stage source-pick then scene-switch authority. Choose-intercept freezes every mandatory same-timing physical response before resolution, drains already-triggered siblings independently, and resumes the selected effect once only when no response cancelled it.

**Tech Stack:** TypeScript, Vitest, public engine dispatcher, pending-runtime serialization, generated QA trace.

**Rules:** `.claude/rules/03-field-areas.md`, `05-turn-phases.md`, `07-action-flow.md`, `08-contact.md`, `09-cutin-disguise.md`, `10-action-event.md`, `11-reasoning.md`, `14-refresh.md`, `15-abilities-effects.md`, `17-icons.md`, `20-color-and-switch.md`, `25-qa-effects-resolution.md`.

## Constraints

- Use the pinned CT-P08/CT-P10 TSV snapshots recorded in `.tmp/_ground-wave25`.
- Drive card behavior through `dispatchEngineAction`; direct engine calls may only support focused unit/horizontal probes.
- Bind every public decision and reject forged, stale, wrong-owner, or replayed authority without mutation.
- Preserve each decision through pending-runtime JSON round-trip where the path pauses.
- Prove controller-relative behavior with `owner='opp'` for at least the two repaired paths.
- Do not hand-edit `.claude/auto/**`; regenerate through repository scripts.

## Cohort

- `B10087`: 10 Q&A for gated mill, effect contact, target authority, posture, hooks, guard/action exclusion, and cut-in draw timing.
- `B10088`: 4 Q&A for exact-three gating, newly removed eligibility, full-scene switch, and effect-enter hooks.
- `B08058`: 5 Q&A for resolution-time level checks, mandatory draw, optional zero target, self counting, and assisted-partner FILE.
- `B08081`: 4 Q&A for immediate interception, full-tail invalidation, multi-target invalidation, and mandatory simultaneous copies.
- `B10071`: 4 Q&A for Misread 3, MR return destination, turn-one wake semantics, and action-declare timing.

## Task 1: Freeze Baseline and RED

- [x] Record all 27 exact IDs as `test-missing` and their expected coverage delta.
- [x] Add public RED for B10088 full-scene effect entry, including owner `opp`, source/switch authority, enter trigger, and runtime round-trip.
- [x] Add public RED for two B08081 copies, including independent turn limits, sequential payments, terminal decline, stale authority, and runtime round-trip.

## Task 2: Minimal Repairs

- [x] Opt B10088 into source-required deferred scene-switch entry without changing other card clauses.
- [x] Collect all eligible choose-intercept protectors at selection time and preserve the remaining queue in resumable pending state.
- [x] Update human and autonomous consumers so every frozen sibling resolves before one resume or terminal cancellation.
- [x] Bind batch, selected UID order, and cancellation to physical GameState witnesses; reject forged runtime payloads transactionally.

## Task 3: Remaining Public Q&A

- [x] Add B10087 public effect-contact and cut-in ordering probes for all 10 IDs.
- [x] Add B08058 public end-phase and FILE8 entry probes for all 5 IDs.
- [x] Add B10071 public Misread/action-declare/declared MR probes for all 4 IDs.
- [x] Assert alternate printings retain base abilities where applicable.

## Task 4: Evidence and Horizontal Investigation

- [x] Run focused RED/GREEN tests and structurally similar scene-entry/intercept suites.
- [x] Update only the 27 selected adjudication items with exact assertion evidence.
- [x] Regenerate QA trace and confirm `matched +27`, `test-missing -27`.
- [x] Record the confirmed defects and Wave 25 decision in `.claude/memory.md`.

## Task 5: T3 Completion

- [ ] Run fresh typecheck, focused and full Vitest, lint, build, smoke, docs/QA gates, and relevant isolated Playwright.
- [x] Obtain Sol engine/adversarial and Terra test review; resolve every BLOCK.
- [ ] Run `git diff --check`, complete diff self-review, commit coherently, and re-prove clean worktree.

## Acceptance

- All 27 QA IDs have public semantic assertions and regenerated matched evidence.
- B10088 switches from a full scene and fires entry hooks without stale-source creation.
- Every eligible physical copy is consumed as mandatory turn-one; cancellation stops only the original selecting effect after all already-triggered siblings resolve.
- Ordered selected UIDs and cancellation survive JSON restore only when the physical batch witnesses agree exactly.
- A mixed B02067-first batch records one causal chain with three sibling payments and one terminal cancel; the original effect resumes zero times.
- No pending side channel or runtime continuation remains after terminal resolution.
