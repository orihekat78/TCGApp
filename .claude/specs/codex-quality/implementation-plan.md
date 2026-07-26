# Codex Quality Implementation Plan

**Goal:** Add accuracy evaluation and optional design-quality specialists.

**Architecture:** JSON holds deterministic policy and golden tasks. A Node
checker validates contracts. Two explicit skills route future work to six
read-only custom agents. Existing `conan-router` and `conan-verify` remain the
small always-loaded control plane.

**Tech stack:** TOML, JSON, Markdown, Node.js ESM, Codex skills.

## Constraints

- Preserve all unrelated dirty work.
- Handwritten Markdown stays at 100 lines or fewer.
- Do not add dependencies, commit, push, or publish.
- New skills use `allow_implicit_invocation: false`.

## Task 1: Evaluation contract

- [ ] Add failing migration expectations for quality files.
- [ ] Run the checker and confirm the expected failure.
- [ ] Add thresholds and at least 12 golden tasks.
- [ ] Add `scripts/check-codex-quality.mjs`.
- [ ] Run syntax, schema, and quality checks.

## Task 2: Accuracy agents

- [ ] Add failing expectations for three agent files.
- [ ] Add read-only rules adjudicator, engine reviewer, and regression hunter.
- [ ] Validate names, model/effort, sandbox, and instructions.

## Task 3: Design agents

- [ ] Add failing expectations for three agent files.
- [ ] Add product design director, UX reviewer, and visual QA.
- [ ] Encode neutral product quality and anti-theme constraints.

## Task 4: Accuracy skill

- [ ] Add a failing skill expectation and run it.
- [ ] Scaffold with `init_skill.py`.
- [ ] Write the minimal evaluation workflow.
- [ ] Disable implicit invocation and run `quick_validate.py`.

## Task 5: Design skill

- [ ] Repeat RED, scaffold, implementation, and validation separately.
- [ ] Reference the design policy only for UI design/review tasks.

## Task 6: Integration

- [ ] Route T2/T3 and UI work to the new optional capabilities.
- [ ] Extend `conan-verify` and migration checks.
- [ ] Update migration ledger and memory.
- [ ] Run all focused gates, `git diff --check`, self-review, and horizontal search.
