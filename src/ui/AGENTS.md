# UI Instructions

## Route

- Read root `AGENTS.md` and relevant UI specs.
- New UI component type, interaction pattern, or visual redesign is T3.
- Use `frontend-design` for new types and redesigns.
- Do not invoke it for copy-only, tiny CSS, or behavior-preserving fixes.

## State And Rules

- Map each visible element to its GameState source.
- Map every changed state field to all UI consumers.
- Game actions must preserve official timing, target, chooser, optionality,
  duration, and confirmation semantics.
- Never treat a visible modal as proof that its behavior is correct.

## Design

- Follow existing component and token conventions.
- Keep operational screens dense, scan-friendly, and predictable.
- Use established icon libraries and controls.
- Avoid nested cards, decorative gradients, and layout-shifting controls.
- Verify text containment and non-overlap on desktop and mobile.

## Verification

- Focused component/hook tests for behavior changes.
- Playwright for every new UI type and all T3 UI changes.
- Exercise click, effect resolution, state result, and console error checks.
- For card exemplars, include valid targets and condition-breaking decoys.
- T3 game flow: mulligan through winner or 30-turn cap.
- Capture desktop and mobile evidence when layout changes.

## Boundaries

- UI must call public engine APIs; no hidden engine mutation.
- Keep human and AI candidate enumeration semantically aligned.
- Investigate equivalent action, assist, reasoning, and case-resolution flows.
