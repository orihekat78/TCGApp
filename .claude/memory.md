# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 =
> [2026-07-13.md](sessions/2026-07-13.md)。

## 2026-07-13 - Codex environment upgrade

- Global defaults: GPT-5.6 Terra medium; review Sol; Luna/Terra/Sol custom roles added.
- Added global `codex-risk-router`; fresh-task probes route T0/T1/T3 to GPT-5.6 correctly.
- Replaced root startup rules with a compact router and added scoped AGENTS for engine/cards/UI/tests/docs.
- Added `conan-session-router`; route probes pass for question, Engine, and new UI. Single-card wording tightened so `card-wave` is batch-only.
- Disabled implicit `using-superpowers` through its Codex policy; fresh-task probe now loads only `conan-session-router`. Migration checker detects policy loss after plugin cache updates.
- Added deterministic `.codex/context/current.md` generation via `npm run docs:codex-context`; focused test passes and output is bounded to 80 lines.
- Regenerated `.claude/auto/structure.md`. Existing application implementation changes were preserved and not modified by this environment work.

## 2026-07-13 — Claude → Codex migration audit

- `caveman@caveman` は enabled、skills 認識済み。ただし plugin の
  SessionStart 自動注入は task log に証跡なし。
- 全 Codex task 用の正本として `C:\Users\arumi\.codex\AGENTS.md` を追加。
  caveman full、言語維持、安全・明瞭性例外、task-local 停止を定義。
- README の active governance 参照 3 件を root `AGENTS.md` へ統一。
  `.claude/CLAUDE.md` は Claude 互換 copy として温存。
- 新規 task probe で root `AGENTS.md` 内の stale `.claude/AGENTS.md` 参照を
  検出し、存在する root `AGENTS.md` へ修正。
- `.codex/hooks.json` の Claude/GNU 前提 PostToolUse hook に
  `commandWindows` を追加。review で quoted `git commit` 偽陽性を検出後、
  PowerShell AST 判定へ変更。commit / quoted / status / compound probe green。
- `C:\Users\arumi\.codex\config.toml` から平文 GitHub PAT と旧 GitHub MCP
  block を除去。GitHub App connector を継続利用。
- 水平確認: project skills 3 件、Serena/Firecrawl/claude-mem MCP、主要 plugins
  は Codex から利用可能。Claude permission allowlist と claudeMdExcludes は
  Codex へ直訳せず、Codex permission profile と targeted rule reads を維持。
- 新規 Codex task 2 件で global caveman full と root AGENTS 読込を実測。
  独立 review は初回 Important 1 件を上記修正後、再 review CLEAN。
