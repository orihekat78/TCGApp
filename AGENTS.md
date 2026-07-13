# AGENTS.md - Conan TCG Codex Router

## Project

- Local-only Detective Conan TCG app: TypeScript, React, Node.js.
- Rules baseline: official manual Ver 2.4.
- MVP decks: CT-D08 and CT-D11; future scope is all cards and rules.
- Public hosting and bundled card images are prohibited.
- Legal detail: `.claude/research/legal/04-recommendation.md`.

## Start

Read only:

1. The nearest nested `AGENTS.md` for files being changed.
2. `.codex/context/current.md` when present; otherwise `.claude/memory.md`.
3. `README.md` for commands or project orientation only.

Do not read full `CHANGELOG.md` or `.claude/auto/structure.md` at startup.
Search or open their relevant sections only when needed.

## Route

- Any implementation/config/review: use `codex-risk-router`.
- Session context selection: use `conan-session-router`.
- Engine: [src/engine/AGENTS.md](src/engine/AGENTS.md).
- Cards: [src/cards/AGENTS.md](src/cards/AGENTS.md).
- UI: [src/ui/AGENTS.md](src/ui/AGENTS.md).
- Tests: [tests/AGENTS.md](tests/AGENTS.md).
- Docs, bugs, memory: [.claude/AGENTS.md](.claude/AGENTS.md).

## Universal Rules

- For game rules or card processing, read `.claude/rules/INDEX.md`, then
  exact topics. Never infer absent rules. Recheck official sources on doubt.
- Preserve unrelated user changes. Never revert or overwrite dirty work.
- Prefer deterministic scripts before agents.
- Locate symbols with Serena or the `locator` agent; read only edit regions.
- Use `apply_patch` for manual edits.
- Keep handwritten Markdown at 100 lines or fewer.
- Generated files under `.claude/auto/` are never hand-edited.

## Risk

- T0: read-only/docs/config; deterministic checks, no review agent.
- T1: additive shipped-pattern clone; focused probe plus mechanical gates.
- T2: new behavior/multi-file wiring; Terra implementation and review.
- T3: engine core, resolver, GameState, security, or new UI type; Sol
  adjudication, adversarial review, full gates, Playwright for UI.
- Project rules may raise but never lower the global risk route.

## Models

- `gpt-5.6-luna`: mechanical collection and documentation audit.
- `gpt-5.6-terra`: normal implementation, grounding, and review.
- `gpt-5.6-sol`: T3 design, semantic conflict, and final adjudication.
- Every subagent call must specify model and reasoning effort.

## Completion

- Verify before claiming completion.
- Investigate structurally similar sites after fixes and additions.
- Record decisions and horizontal findings in `.claude/memory.md`.
- Before user review, state self-review and horizontal investigation status.
- Never publish, deploy, push, merge, or expose secrets without scope.

Historical detailed policy and numeric targets remain in
`.claude/CLAUDE.md`; active Codex instructions in this file and nested
`AGENTS.md` files take precedence.
