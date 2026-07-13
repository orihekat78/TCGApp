---
name: conan-session-router
description: Route work in the Conan TCG repository to the minimum required context, local instructions, skills, model tier, and verification gates. Use at the start of every Conan repository task, including questions, card work, engine changes, UI work, tests, documentation, and refactors.
---

# Conan Session Router

## Start

1. Read the nearest `AGENTS.md` for the files involved.
2. Read `.codex/context/current.md` when present; otherwise read `.claude/memory.md`.
3. Classify the request using [routes.md](references/routes.md).
4. State one compact route line: `route=<kind> tier=<T0-T3> model=<Luna|Terra|Sol> skills=<names|none>`.
5. Proceed immediately. Do not add an approval checkpoint unless the action itself requires human authorization.

Do not invoke `superpowers:using-superpowers`. Select only the individual skill that directly serves the task. Do not read full `CHANGELOG.md`, `.claude/auto/structure.md`, or broad source trees during startup.

## Context Rules

- Start from indexes, exact sections, symbols, and references; open implementation files only after locating the relevant symbol.
- For game-rule or card semantics, open `.claude/rules/INDEX.md`, then only exact rule files. Never infer missing rules.
- For locate work, use Serena or `locator`; do not pre-list speculative implementation files.
- Use `codex-risk-router` for code or behavior changes. Pure questions and tiny documentation lookups do not need it.
- Use TDD and verification skills only when implementation work begins, not for route classification or ordinary questions.

## Models

- `Luna`: T0 lookup, deterministic collection, status, exact-file documentation.
- `Terra`: T1/T2 implementation, focused tests, normal review.
- `Sol`: T3 orchestration, engine/state/resolver risk, adversarial final review.
- Always use GPT-5.6 roles or these names. Ignore stale Claude model guidance in legacy files.

## Finish

Apply the gates selected by the route and risk tier. Record actual work in `.claude/memory.md`; rotate per project rules. Never commit unless the user explicitly requests it.
