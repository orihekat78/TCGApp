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

- Every task: use `conan-router` for context, risk, model, skills, and gates.
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
- After dispatching GitHub CI, do not poll, watch, sleep, or otherwise wait for
  it in an active turn. End the turn and resume only on an external notification
  or explicit user message that CI completed; inactive waiting consumes no tokens.

## Token Efficiency

- End and hand off after two implementation waves or around 60% context; continue
  the next wave only in a fresh user-created task.
- Default to no delegation. When delegation is required, reuse agents and cap
  total spawned threads at 4 unless the user explicitly requests broader parallel work.
- Every spawn uses `fork_turns="none"` or at most `"3"`; never use `"all"`.
- Use one bounded wait per collection point. Never poll with repeated
  `wait_agent` or `list_agents` calls.
- Limit inspection output to 200 lines or 100 KB per call. Store larger artifacts
  on disk and return a path plus a compact summary.
- Use local paths or URLs for images; never inject base64 when either is available.
  Move image-heavy follow-up work to a fresh task.

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

## Quality

- T0/T1 use the economy profile; T2 uses Terra high; T3 uses Sol high/xhigh.
- Codex workflow or token changes use explicit `conan-accuracy`; no validated
  result files means accuracy is unproven.
- Visual or UX work uses explicit `conan-design`; product quality takes priority
  over franchise decoration.
- Project custom agents are read-only judges; implementation stays in the main task.

## Completion

- Use `conan-verify` before claiming completion.
- Investigate structurally similar sites after fixes and additions.
- Record decisions and horizontal findings in `.claude/memory.md`.
- Before user review, state self-review and horizontal investigation status.
- User grants standing authorization for this repository to commit, push, merge, deploy, publish,
  and create or comment on GitHub PRs/issues when needed for the requested work.
  Keep commits coherent and gated; never expose secrets.

Historical detailed policy and numeric targets remain in
`.claude/CLAUDE.md`; active Codex instructions in this file and nested
`AGENTS.md` files take precedence.
