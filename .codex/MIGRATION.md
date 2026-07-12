# Codex Migration Ledger

## Canonical project record

`.claude/` remains the canonical project record. Its rules, specifications,
research, bugs, reports, generated documentation, changelog entries, memory,
sessions, and card data are retained in place and are read or updated by Codex.
`.claude/worktrees/` is historical or isolated work and is excluded from normal
repository scans.

## Claude-to-Codex mapping

| Claude asset | Codex treatment |
| --- | --- |
| `CLAUDE.md` | Durable rules are represented by root `AGENTS.md`. |
| `settings.json` | Permission allowlists are not imported; Codex sandbox and approval rules apply. |
| `settings.local.json` | Local Claude permissions are retained as history, not executed by Codex. |
| Claude hooks | Mechanical checks are implemented as npm scripts or explicit verification steps. |
| `.claude/skills/` | Canonical source for the byte-identical `.agents/skills/` Codex mirror. |
| `.mcp.json` | Server definitions are represented in `.codex/config.toml`. |
| `.claude/memory.md` and `sessions/` | Continued Codex work log and handoff record. |

## MCP credentials

The Firecrawl API key is intentionally absent from repository configuration.
Provide it through a user-local Codex configuration or environment mechanism
after rotating the previously exposed credential. Never commit the replacement.

## Validation commands

- `npm run sync:codex-skills` synchronizes project skills.
- `npm run check:codex-migration` checks paths and skill parity.
- `npm run typecheck` verifies TypeScript independently of migration checks.
