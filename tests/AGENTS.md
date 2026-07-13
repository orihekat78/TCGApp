# Test Instructions

## Purpose

- Tests prove required behavior, not current implementation shape.
- Behavior changes use RED-GREEN verification.
- Fixtures must be asymmetric when testing owner/opponent orientation.
- Direct effect execution does not replace real dispatch-path coverage.

## Risk Gates

- T0: parser, link, diff, or exact deterministic check.
- T1: focused probe, typecheck, relevant lint, baseline required by project.
- T2: TDD, focused integration, full Vitest, lint, smoke.
- T3: all mechanical gates, adversarial review, and Playwright when visible.

## Required Cases

- Zero hand, deck, scene, evidence, and candidate sets.
- Deck refresh and deck-out loss.
- Irreversible transitions and inability to move backward.
- AP/LP/level negative and LP at or below zero.
- Optional decline and opponent decisions.
- Disguise inheritance and contact expiry.
- Simultaneous, chained, and re-entry behavior.

## UI And E2E

- New UI types require desktop and mobile verification.
- Test interaction through state resolution, not screenshot alone.
- Confirm console errors are zero.
- Card text tests include valid and decoy targets.
- Human-vs-CPU T3 regression runs to winner or 30-turn cap.

## Review

- Test reviewer finds missing branches, false-green assertions, and fixture
  symmetry.
- Review agents do not rerun broad suites already evidenced by the main task.
- A test that pins behavior contradicting rules must be corrected, not trusted.
- Investigate structurally similar tests and production consumers.
