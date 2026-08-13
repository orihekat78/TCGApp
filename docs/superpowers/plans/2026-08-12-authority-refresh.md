# Official Authority Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale 2,240-printing authority with a reviewed official snapshot, prove every card/FAQ/rules change, and publish the exact inputs required by legality and card-semantics waves.

**Architecture:** Fetch only Takara Tomy primary sources twice into a unique external temporary tree, require identical canonical digests, compare them to tracked hash-only authority before any repository write, then atomically publish reviewed generated artifacts. Keep unresolved rule judgments in a strict versioned exception table; never infer behavior from tests or old snapshots.

**Tech Stack:** Node.js/TypeScript, official JSON API, SHA-256, Vitest, existing card and QA generators.

## Global Constraints

- Start only from clean `main` with `HEAD === origin/main`; network refresh is forbidden in a dirty worktree.
- Official hosts only: `www.takaratomy.co.jp`; redirects, content type, byte limits, duplicate IDs, and schema drift fail closed.
- Never hand-edit `.claude/auto/**`, `_raw/**`, TSV, status, QA snapshot, generated CardDefs, or Meta generated identity files.
- Raw official bodies and TSV remain ignored local artifacts and must never be tracked; only hash-only authority metadata and reviewed reports may enter Git.
- Do not claim 2,256 printings, PR305–PR320, a FAQ total, manual version, or errata count until the fresh packet proves it.
- Restrictions remain event warnings, separate from base deck-legality errors.

---

### Task 1: Fail-closed authority packet

**Files:** Create `scripts/cards/authority-refresh.cjs`, `scripts/cards/authority-diff.cjs`, `tests/scripts/cards-authority-refresh.test.ts`; modify `package.json`. Task 3 publishes the first tracked hash-only `authority-field-index.json` after bootstrap review.

**Interfaces:** Produce `buildAuthorityPacket({projectRoot,tempRoot,fetchedAt}): {status,qaSnapshot,fieldIndex,diff,sourceDigests,artifacts}` and `validateAuthorityPacket(packet,prior,{packetRoot,projectRoot}): void`; a separate publishability validator requires dispositions for every removal, existing-printing update, and FAQ answer change. CLI uses a run-specific `mkdtemp` directory and publishes those exact rehashed artifacts offline.

- [ ] RED fixtures reject non-official redirects, HTML where JSON/PDF is expected, oversized bodies, missing/duplicate card numbers, raw/TSV mismatch, FAQ ID collision/conflicting answers, removed printings, and unreviewed existing-card text changes.
- [ ] RED exact set-diff emits sorted `added`, `removed`, `changedFields`, `qaAdded`, `qaRemoved`, and `qaAnswerChanged`; unresolved removals/changes make the packet non-publishable. The initial bootstrap may use the tracked card-number set plus `updated_at > prior fetchedAt` review flags because no prior field index exists; do not claim exact historical field names or hard-code PR305–PR320 as truth.
- [ ] Implement external-temp acquisition using existing `official-api.cjs`, `cards-data-status.cjs`, and `write-qa-hash-snapshot.cjs`; repository writes remain zero until validation succeeds.
- [ ] Run `npx vitest run tests/scripts/cards-authority-refresh.test.ts tests/compiler/qa-normalize.test.ts tests/scripts/gen-qa-trace.test.ts --maxWorkers=1`; commit `feat(cards): add reviewed authority refresh packet`.

### Task 2: Rules provenance and authority exceptions

**Files:** Create `.claude/specs/authority-exceptions.json`, `scripts/cards/validate-authority-exceptions.ts`, `tests/scripts/validate-authority-exceptions.test.ts`; modify `.claude/rules/sources.md`, `.claude/rules/27-card-restrictions.md`, `.claude/rules/28-errata.md`, `.claude/rules/29-floor-rule-timing.md`, `package.json`.

**Interfaces:** Produce strict schema v1 with six snapshot hashes and exception fields `id`, `cardId`, `printings`, `clauseRef`, `missingAuthority`, `blockedBehavior`, `sourceUrls`, `status:'blocked'`, `reviewedAt`.

- [ ] RED rejects unknown keys, non-Takara URLs, invalid hashes/dates/status, duplicate exception/card ownership, stale snapshot hashes, and a blocked card registered with guessed semantics.
- [ ] Fetch and hash `rule_manual.pdf`, `floor_rule.pdf`, current `/card_limit/limit`, and `/errata`; record exact URL, fetched date, extracted version/count, and digest without copying full official text.
- [ ] Fix the stale restriction URL and broken floor-rule link; preserve prohibited B02041/B01058 and restricted PR155/B01006 only if fresh authority confirms them.
- [ ] Run focused validator tests plus `npm run docs:check`; commit `docs(rules): refresh official authority provenance`.

### Task 3: Atomic catalog and FAQ publication

**Files:** Modify generated outputs under `.claude/specs/cards-data/**` only through `cards:fetch`, `cards:status`, and `cards:qa-snapshot`; create `.claude/reports/2026-08-12-authority-refresh/diff.json` and `verification.md`.

**Interfaces:** Consume the reviewed Task 1 packet; produce ignored raw/TSV artifacts plus tracked hash-only status/FAQ/field-index snapshots with identical card-number hashes and zero conflicts.

- [ ] On clean exact main run `npm run cards:check:live-status` and record the expected RED without editing tracked files.
- [ ] Run the packet in a temporary tree; review every added/removed/changed card and FAQ answer hash. Any unexplained removal or changed answer stops publication.
- [ ] Run `npm run cards:authority:publish -- --packet "<run-specific-external-packet>"`; the offline publisher reads `fetchedAt` from that packet, rehashes every artifact, regenerates status/FAQ, and rejects any byte mismatch or prior-HEAD drift.
- [ ] Run `npm run cards:check:live-status`, `npm run qa:adjudication:verify-local`, and `git diff --check`; commit `data(cards): refresh official catalog and FAQ authority`.

### Task 4: Newly added printing runtime grounding

**Files:** Create `scripts/cards/ground-authority-diff.cjs`; modify only CardDefs/barrels/tests identified by Task 3; never run `gen-partners.cjs` blindly.

**Interfaces:** For each added printing, produce either an exact post-errata CardDef/reuse mapping with behavior tests or one `authority-exceptions.json` blocked entry; production empty stubs are forbidden.

- [ ] Run `node scripts/cards/ground-authority-diff.cjs --packet "$env:TEMP\conan-authority-refresh\packet.json"`; it calls the existing grounding pipeline for the packet's sorted `diff.added` list and rejects IDs absent from the packet.
- [ ] RED each non-identical behavior through the public engine path with valid and condition-breaking decoys; reuse only when all semantic fields and Q&A match.
- [ ] Run `npm run lint:card-addition`, focused card/engine tests, `npm run typecheck`, and `npm run smoke:1000`; commit in reviewed semantic clusters.

### Task 5: FAQ adjudication and generated trace

**Files:** Modify QA adjudication shards and approved overrides by review; modify `.claude/auto/**` only through `npm run docs`.

**Interfaces:** Classify every genuinely new semantic `qaId` as behavior-test-backed or authority-blocked; mechanical ID remaps plus `removed` and `answerChanged` items require explicit reviewer disposition. Historical reviewed `test-gap` rows are a separate closure wave.

- [ ] Run `npm run qa:adjudication:queue`; RED the pinned baseline until every added/removed/changed item has a reviewed disposition.
- [ ] Add exact linked behavioral tests or strict exception references; do not use one broad test to claim unrelated Q&A semantics.
- [ ] Review the exact adjudication improvement diff, then run `npm run lint:qa -- --write-baseline`, `npm run qa:adjudication:merge -- --require-reviewed`, `npm run qa:adjudication:verify-local -- --require-reviewed`, `npm run lint:qa -- --require-reviewed`, and `npm run docs`; commit `test(cards): adjudicate refreshed official FAQ`. Do not use global `--require-all` to misclassify unrelated historical reviewed gaps as authority-refresh failures.

### Task 6: Authority closeout gate

**Files:** Finalize `.claude/reports/2026-08-12-authority-refresh/verification.md` under 100 lines.

- [ ] Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run lint:card-addition`, `npm run docs:check`, `npm run smoke:1000`, `npm run cards:check:live-status`, and `git diff --check origin/main...HEAD`.
- [ ] Independent rules and adversarial reviewers must confirm exact source-to-CardDef-to-test links, zero guessed behavior, zero unexplained authority drift, and a clean synchronized main before Wave 2.
- [ ] Commit `docs(cards): record authority refresh verification` and push only after all gates pass.
