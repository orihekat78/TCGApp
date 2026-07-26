---
name: conan-history
description: Retrieve prior Conan project decisions, fixes, experiments, and session history from claude-mem with bounded three-layer search. Use when the user asks what happened before, whether work was already done, why a decision exists, or when current files lack necessary historical context.
---

# Conan History

Use history only when present repository state and `.codex/context/current.md` do
not answer the question. Do not inject session history at ordinary task startup.

## Search

1. Call `mcp__mcp_search__search` with `project="conan"`, a specific query, and
   `limit=10`. Do not set `platformSource`; Conan history includes Claude work.
2. Keep only IDs directly relevant to the current question.
3. If sequence matters, call `timeline` around one anchor with
   `depth_before=2`, `depth_after=2`, and `project="conan"`.
4. Call `get_observations` once with only the filtered IDs, maximum 5.
5. Summarize decisions and evidence. Include observation IDs and dates when
   useful. Treat memory as historical evidence, not current truth; verify against
   repository files before changing code.

Never call `session_start_context`, `observation_context`, corpus builders, or
unbounded/full-history retrieval for routine work. Stop after the index when it
already answers the question.
