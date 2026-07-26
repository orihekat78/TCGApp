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
| `.claude/skills/` | Source for three mirrored wave skills; Codex-native routing/history/verification live in `.agents/skills/`. |
| `.mcp.json` | Server definitions are represented in `.codex/config.toml`. |
| `.claude/memory.md` and `sessions/` | Continued Codex work log and handoff record. |

## MCP credentials

The Firecrawl API key is intentionally absent from repository configuration.
Provide it through a user-local Codex configuration or environment mechanism
after rotating the previously exposed credential. Never commit the replacement.

## Validation commands

- `npm run sync:codex-skills` synchronizes project skills.
- `npm run check:codex-migration` checks paths and skill parity.
- `npm run check:codex-efficiency` reports the reproducible token/context A/B.
- `npm run typecheck` verifies TypeScript independently of migration checks.

## Project efficiency defaults

- Project config overrides the user default with Terra at medium effort.
- Tool results stop at 6,000 tokens; structured compaction starts at 96,000
  body-after-prefix tokens.
- Spawned-agent concurrency is capped at three; subagents default to Terra medium.
- `AGENTS.md` bounds history inheritance, polling, output size, images, and task lifetime.
- `npm run check:codex-migration` rejects drift in these defaults.

## Native replacements

- `conan-router` replaces `conan-session-router` plus `codex-risk-router`.
- `conan-history` is the only normal bridge to Claude history. It searches index,
  timeline, then at most five selected observations.
- `conan-verify` replaces the Superpowers completion workflow.
- 66 unrelated or superseded skills are disabled for this project. Their files
  and MCP servers remain installed; other projects are unchanged.

## Memory trial

Native Codex Memories generation and injection are enabled. Sessions using MCP,
web, or tool search are excluded from generation. The trial therefore favors
small local decisions over large external-context transcripts. Restart Codex
before judging skill and memory behavior.

## A/B baseline

The deterministic route proxy remains 3/3. Estimated active skill metadata drops
from 98 skills / 14,894 characters to 34 / 5,033. Router payload drops from
7,981 to 2,849 bytes. These are startup-context proxies, not billing telemetry.

## Quality layer

- `npm run check:codex-quality` validates 13 golden tasks across eight categories,
  with at least three measured repetitions per task for scored runs.
- Critical tasks require 100%; overall tasks require 95%; unsupported claims and
  scope violations require zero.
- `conan-accuracy` refuses PASS without independently scored baseline and
  candidate result files.
- Accuracy agents cover rule adjudication, engine semantics, and horizontal
  regression search.
- `conan-design` enforces neutral product quality and rendered evidence.
- Design agents cover direction, UX, and visual QA. Both new skills are explicit
  only, so ordinary startup context does not grow.
