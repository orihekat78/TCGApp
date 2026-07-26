---
name: conan-accuracy
description: Use when evaluating Codex model, prompt, context, memory, routing, skill, agent, or token-efficiency changes for Conan; when comparing quality profiles; or before claiming an optimization preserves or improves accuracy.
---

# Conan Accuracy

Treat accuracy as a release gate, not an impression.

1. Run `npm run check:codex-quality` to validate the corpus and thresholds.
2. Use `.codex/evals/golden-tasks.json` unchanged for both variants.
3. Run baseline and candidate with the same task prompt, repository state, model
   role, effort, permissions, and at least three repetitions. Keep evaluators
   independent from implementation context.
4. Score every task as `passed`, `unsupportedClaims`, `scopeViolations`, and
   concise evidence. Critical tasks require exact supporting evidence and gates.
5. Validate each result set:
   `node scripts/check-codex-quality.mjs --results <path>`.
6. Compare accuracy, critical failures, token usage, latency, and variance
   separately. A token reduction cannot offset any critical regression.

No result file means **UNPROVEN**, never PASS. Any unsupported rule claim, scope
violation, critical failure, unequal test condition, or missing task makes the
candidate fail. Preserve raw results outside model-authored summaries.
