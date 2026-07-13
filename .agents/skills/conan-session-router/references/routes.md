# Conan Routes

| Kind | Minimum startup context | Skills | Default tier/model |
|---|---|---|---|
| Question | Exact README or indexed section only | none | T0 / Luna |
| Card | current context, `src/cards/AGENTS.md`, rules index + exact topics, grounding dossier/checklist/exemplar | `card-wave` only for batches/waves; `codex-risk-router` for changes | T1 Terra; T2 if new verb/wiring |
| Engine | current context, `src/engine/AGENTS.md`, rules index + exact topics; locate symbols first | `engine-wave`, `codex-risk-router` | T2 Terra or T3 Sol |
| UI | current context, `src/ui/AGENTS.md`, relevant spec/component; `tests/AGENTS.md` when testing | `frontend-design` only for new UI type/redesign; `codex-risk-router` | T1/T2 Terra; T3 Sol |
| Refactor | current context, nearest instructions, exact refactor phase | `refactor-phase`, `codex-risk-router` | T3 Sol |
| Tests/docs | nearest instructions and exact target | focused individual skill only | T0 Luna or T1 Terra |

## Route Details

### Question

Read only what answers the question. No TDD, no verification skill, no repository-wide scan.

### Card

Run `npm run ground -- <ID>...` before semantic design. Compare every printed-text clause to the DSL. Batch/wave work uses `card-wave`. For one existing-exemplar clone, the route line's skills MUST omit `card-wave`; select only `codex-risk-router`. Follow the card checklist and exact rules. Do not edit Engine to support a card.

### Engine

Use Serena or `locator` before reading source. Use `engine-wave` for an extension wave. New verbs, multi-point emit wiring, resolver/flow core, `GameState`, or rule interpretation are T2/T3. Avoid guessing filenames before symbol location.

### UI

Use `frontend-design` for a new component type, redesign, or meaningful visual direction. Reusing an established component does not require it. T3 or new UI-type rounds require Playwright interaction, desktop/mobile layout, and console-error checks.

### Refactor

Use `refactor-phase`; preserve behavior, phase records, baselines, and adversarial review. Engine or broad state changes remain T3.

## Gates

- T0: answer or deterministic check.
- T1: focused probe, typecheck/lint as applicable, focused tests, self-review, horizontal search.
- T2: T1 plus semantic and edge-test lenses, relevant smoke/lints.
- T3: full project gates, adversarial review, Playwright when UI-visible, rule/state completeness checks.
