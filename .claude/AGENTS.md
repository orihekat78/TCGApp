# Documentation And Session Instructions

## Generated Documentation

- Files under `.claude/auto/` are generated; never hand-edit them.
- Use `npm run docs:<category>` or `npm run docs` to regenerate.
- Use `npm run docs:check` for drift.
- `.claude/auto/README.md` is the only handwritten exception.
- CHANGELOG is generated from `.claude/changelog-entries/`.

## Bugs And Risk

- One confirmed bug per `.claude/bugs/BUG-XXX.md`.
- Include frontmatter, expected/actual behavior, related files, RCA,
  horizontal investigation, and prevention.
- Update status and commit only after the fix is verified.
- Use `.claude/bugs/index.base` as the aggregate view.
- Monthly audit runs bug trend and required bug/listener/card lint.

## Memory

- Keep `.claude/memory.md` as a short resumable scratchpad.
- Record decisions, implementation, verification, and horizontal findings.
- Rotate before exceeding 80 lines into
  `.claude/sessions/YYYY-MM-DD[-N].md`.
- Use claude-mem for historical search; do not duplicate long history.

## Markdown

- Handwritten Markdown must stay at 100 lines or fewer.
- Split by topic before exceeding the limit.
- README stays a thin introduction, startup guide, and link hub.
- Structure belongs in generated structure docs.
- Phase/Round history belongs in changelog entries.

## Design Documents

- Game designs must map relevant rules explicitly.
- List at least five edge cases including zero, irreversible, state
  interaction, negative values, and chained behavior.
- Include horizontal investigation and GameState-to-UI mapping when relevant.
- Unknown rule behavior remains unresolved pending user or official source.

## Session Boundary

- One phase should produce one coherent commit when the user requests commits.
- After one or two phases, update the next-session prompt and memory.
- Recommend a fresh task when fixed context becomes stale.
- Never commit, push, merge, or publish unless the user requests it.

The legacy `.claude/CLAUDE.md` preserves historical detail. Active Codex
instructions in root and nested AGENTS files take precedence.
