---
name: conan-router
description: Route every Conan TCG repository task to the minimum context, risk tier, GPT-5.6 model, focused skills, and verification gates. Use for questions, implementation, fixes, refactors, review, configuration, cards, engine, UI, tests, and docs.
---

# Conan Router

## Start

1. Read the nearest `AGENTS.md`.
2. Read `.codex/context/current.md`; fall back to `.claude/memory.md`.
3. Select the highest matching route and state:
   `route=<kind> tier=<T0-T3> model=<Luna|Terra|Sol> skills=<names|none>`.
4. Continue. Ask only when authority or intent is materially ambiguous.

Never read full `CHANGELOG.md`, `.claude/auto/structure.md`, or broad source trees
at startup. Locate symbols with Serena or `locator`, then open exact regions.

## Routes

| Kind | Context/skill | Tier/model |
|---|---|---|
| Question/docs | exact indexed section | T0/Luna |
| Card | cards AGENT; rules index + exact topics; `card-wave` only for waves | T1/Terra; T2 for new wiring |
| Engine | engine AGENT; exact rules; `engine-wave` for extension waves | T2/Terra; core/state/resolver T3/Sol |
| UI | UI AGENT; relevant spec/component; `conan-design` for visual/UX work | T1-T2/Terra; new type T3/Sol |
| Refactor | exact phase; `refactor-phase` | T3/Sol |
| Tests/config | nearest AGENT and exact target | T0-T2/Luna or Terra |

Game-rule/card work must read `.claude/rules/INDEX.md`, then exact topics.
Never infer absent rules. Ground cards before semantic design.

## Risk and gates

- T0: read-only/docs/narrow config; deterministic check and diff.
- T1: shipped-pattern clone; focused probe, relevant type/lint/test.
- T2: new behavior or multi-file contract; RED first, relevant suite, Terra high review.
- T3: engine core, `GameState`, resolver, security, destructive change, or new UI
  type; Sol adjudication, adversarial review, full gates, Playwright for visible UI.

Unclear ownership/spec, shared consumers, concurrency, or irreversible change raises
one tier. Prefer deterministic scripts. No subagent unless the user or an applicable
skill explicitly requests delegation. Before completion use `conan-verify`.

## Quality routing

- Codex model, prompt, context, memory, skill, agent, or token changes:
  explicitly use `conan-accuracy`; no result files means UNPROVEN.
- Rule/card conflicts: `rules_adjudicator`.
- Engine/state/resolver T2-T3: `engine_reviewer`.
- Cross-cutting change or fix: `regression_hunter`.
- New UI type/redesign: `conan-design` then `product_design_director`,
  `ux_reviewer`, and post-implementation `visual_qa`.
