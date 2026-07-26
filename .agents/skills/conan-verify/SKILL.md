---
name: conan-verify
description: Verify Conan repository changes with fresh, risk-proportional evidence before completion claims, review handoff, commit, or publication. Use after implementation, fixes, refactors, configuration changes, and generated artifacts.
---

# Conan Verify

1. Re-read the requested outcome and selected `conan-router` tier.
2. Inspect `git diff --check`, scoped diff, and status. Preserve unrelated work.
3. Run fresh gates; never rely on an earlier run or an agent's claim:
   - T0: parse/link/schema check plus targeted deterministic checker.
   - T1: focused tests and relevant typecheck/lint.
   - T2: T1 plus relevant suite, edge cases, and horizontal search.
   - T3: full required project gates, adversarial review, and Playwright for
     visible UI.
4. Use `engine_reviewer` for engine/state contracts, `rules_adjudicator` for
   rule conflicts, and `regression_hunter` for cross-cutting changes.
5. Visible UI requires rendered before/after evidence and `visual_qa`; new UI
   types also require `product_design_director` and `ux_reviewer`.
6. Codex workflow changes run `npm run check:codex-quality`; accuracy claims
   require result files validated through `conan-accuracy`.
7. For docs/config/skills run their parser or validator. For skills also run
   `quick_validate.py` and one realistic bounded probe.
8. Review every changed file for accidental scope, placeholders, stale paths,
   generated-file edits, and unsupported claims.
9. Report exact passes, failures, skipped gates with reason, self-review status,
   and horizontal-investigation status.

Do not say complete, fixed, passing, or ready until current evidence supports it.
If a gate fails, report the failure and continue only with an in-scope fix.
