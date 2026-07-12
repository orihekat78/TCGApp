# Codex Migration: Skills and Handoff Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three project skills deterministically available to Codex and finish with an auditable migration record.

**Architecture:** `.claude/skills/` remains canonical. `.agents/skills/` is a byte-identical Codex-facing mirror, synchronized by a Node ESM script and enforced by the checker created in the configuration plan.

**Tech Stack:** Node.js ESM, SHA-256, npm, Git, Markdown.

## Global Constraints

- Do not alter non-migration project code or `.claude/worktrees/`.
- Do not store credentials; do not stage the user's existing work.
- Keep Markdown at or below 100 lines.

---

### Task 3: Make project skills a verified Codex mirror

**Files:** Create `scripts/sync-codex-skills.mjs`; modify checker, `package.json`, and the three `.agents/skills/*/SKILL.md` files.

**Consumes:** `.claude/skills/{card-wave,engine-wave,refactor-phase}/SKILL.md`.

**Produces:** `npm run sync:codex-skills` and `npm run check:codex-migration`.

- [ ] **Step 1: Add failing parity assertions**

Extend `scripts/check-codex-migration.mjs`: for `card-wave`, `engine-wave`, and `refactor-phase`, SHA-256 hash `.claude/skills/<name>/SKILL.md` and `.agents/skills/<name>/SKILL.md`; throw `skill drift: <name>` when unequal.

- [ ] **Step 2: Demonstrate current drift**

Run: `node scripts/check-codex-migration.mjs`

Expected: FAIL with all drifted names.

- [ ] **Step 3: Implement synchronization**

Create `scripts/sync-codex-skills.mjs` to loop over the same names, call `mkdir(targetDirectory, { recursive: true })`, `copyFile(source, target)`, and print `synced: <name>`.

- [ ] **Step 4: Wire and verify npm commands**

Add to `package.json`: `"sync:codex-skills": "node scripts/sync-codex-skills.mjs"` and `"check:codex-migration": "node scripts/check-codex-migration.mjs"`.

Run: `npm run sync:codex-skills && npm run check:codex-migration`

Expected: three `synced:` lines followed by `codex migration checks passed`.

- [ ] **Step 5: Commit the skill task**

Run: `git add scripts/sync-codex-skills.mjs scripts/check-codex-migration.mjs package.json .agents/skills && git commit -m "build(codex): verify project skill mirror"`

Expected: only listed migration paths, subject to the docs gate.

### Task 4: Final verification and handoff

**Files:** Modify `.claude/memory.md` (or rotate first to `.claude/sessions/2026-07-11.md`).

- [ ] **Step 1: Run final validation**

Run: `npm run check:codex-migration && npm run typecheck`

Expected: migration check passes; report typecheck separately because existing engine work may affect it.

- [ ] **Step 2: Verify migration scope**

Run: `git diff --check; git status --short -- AGENTS.md .codex .agents scripts package.json .gitignore .claude/memory.md`

Expected: no whitespace errors or unplanned code paths.

- [ ] **Step 3: Record and report**

Append canonical paths, credential separation, skill commands, and the `docs:check` blocker to the work log, rotating before 80 lines. Report whether the Firecrawl credential has been rotated; never bypass a stale docs hook.
