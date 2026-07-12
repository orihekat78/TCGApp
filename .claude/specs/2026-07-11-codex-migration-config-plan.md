# Codex Migration: Configuration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain `.claude/` as canonical while making Codex a safe, documented project surface.

**Architecture:** `AGENTS.md` is the Codex entrypoint; `.claude/` retains every project record. `.codex/` holds non-secret Codex configuration and a migration ledger. Claude permissions and hooks become documented Codex workflow rules rather than executable imports.

**Tech Stack:** Codex Desktop configuration, Markdown, TOML, Node.js ESM, npm, Git.

## Global Constraints

- Do not move/delete/duplicate non-skill `.claude/` files or edit `.claude/worktrees/`.
- Do not modify or stage existing engine/card work.
- Keep Markdown at or below 100 lines; never store credentials in repository files.
- Rotate the exposed Firecrawl credential before re-enabling that MCP server.

---

### Task 1: Establish the Codex migration ledger and safe MCP boundary

**Files:** Create `.codex/MIGRATION.md`; modify `.codex/config.toml`, `.gitignore`. The existing skip-worktree `.mcp.json` is verified but not staged.

**Produces:** A non-secret mapping of Claude configuration categories to Codex locations.

- [ ] **Step 1: Prove the current credential issue**

Run: `rg -n 'fc-[A-Za-z0-9]+' .codex .mcp.json`

Expected: match in the current baseline.

- [ ] **Step 2: Write the migration ledger**

Create `.codex/MIGRATION.md` with these mappings: `.claude/` canonical; `AGENTS.md` Codex entrypoint; `.agents/skills/` mirrors `.claude/skills/`; `settings*.json` permissions/hooks are non-portable records; `.mcp.json` maps to `.codex/config.toml`; worktrees are retained but excluded; memory/sessions stay in `.claude/`.

- [ ] **Step 3: Separate configuration from credentials**

Keep Firecrawl command/args but remove `[mcp_servers.firecrawl.env]`; change Serena `--context` to `codex`; add `/.codex/config.local.toml` to `.gitignore`.

- [ ] **Step 4: Verify**

Run: `rg -n 'fc-[A-Za-z0-9]+' .codex .mcp.json; git check-ignore .codex/config.local.toml`

Expected: no credential match; local override is ignored. Ask the user to rotate and provide a replacement outside Git before Firecrawl use.

- [ ] **Step 5: Commit the isolated task**

Run: `git add .codex/MIGRATION.md .codex/config.toml .gitignore && git commit -m "chore(codex): secure migration config"`

Expected: only those paths. If pre-existing `docs:check` drift blocks it, report the blocker; do not bypass hooks or regenerate unrelated docs.

### Task 2: Normalize Codex instructions to the canonical record

**Files:** Modify `AGENTS.md`; create `scripts/check-codex-migration.mjs`.

**Produces:** No live `.Codex/` paths and a repeatable migration validator.

- [ ] **Step 1: Write a failing checker**

`scripts/check-codex-migration.mjs` must require `AGENTS.md` to omit `.Codex/`, include `.claude/rules/INDEX.md`, `.claude/memory.md`, and `.claude/worktrees/`, and confirm `.claude/{auto,bugs,research,rules,sessions,specs}` all exist.

- [ ] **Step 2: Demonstrate baseline failure**

Run: `node scripts/check-codex-migration.mjs`

Expected: FAIL, naming stale `.Codex/` references.

- [ ] **Step 3: Update `AGENTS.md`**

Replace each live `.Codex/` reference with `.claude/`, preserving review/rule/memory policies. Add: Codex reads and updates `.claude/`; normal scans exclude `.claude/worktrees/`; Claude permission allowlists/hooks are historical and not executable Codex policy.

- [ ] **Step 4: Verify and commit**

Run: `node scripts/check-codex-migration.mjs; rg -n '\.Codex/' AGENTS.md`

Expected: `codex migration checks passed`, then no `rg` output.

Run: `git add AGENTS.md scripts/check-codex-migration.mjs && git commit -m "docs(codex): use canonical Claude records"`

Expected: only those paths, subject to the existing docs gate.
