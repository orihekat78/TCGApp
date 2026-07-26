# Product Design Principles

## Foundation

- Build a restrained, modern product interface.
- Let cards, game state, and user decisions carry identity.
- Optimize for comprehension, confidence, and speed before decoration.
- Keep the visual system consistent across game and meta-app screens.

## Hierarchy

- Give every screen one dominant task and one obvious next action.
- Use size, weight, spacing, and placement before extra color or borders.
- Keep secondary information quiet but discoverable.
- Group by user intent, not implementation ownership.

## Visual system

- Use a small spacing scale and predictable alignment.
- Use typography roles consistently; avoid arbitrary sizes and weights.
- Reserve semantic colors for state, risk, selection, and feedback.
- Prefer reusable component variants over page-specific styling.
- Keep surfaces calm enough for card art and board state to remain legible.

## Interaction

- Make click, selection, disabled, pending, success, and failure states distinct.
- Preserve context during modal, choice, and confirmation flows.
- Make irreversible actions explicit.
- Support keyboard focus, readable contrast, and adequate touch targets.
- Show feedback close to the action that caused it.

## Responsive quality

- Validate desktop and landscape `851x393`.
- Preserve action priority and information hierarchy at both sizes.
- Avoid hiding required actions behind clipping or accidental scrolling.
- Portrait remains out of scope unless explicitly requested.

## Avoid

- Detective clichés, ornamental evidence boards, fingerprints, magnifying
  glasses, crime tape, or forced franchise colors.
- Theme-first choices that reduce clarity.
- Excessive gradients, glow, glass, shadows, borders, and nested cards.
- Rebuilding implemented screens in Figma as the source of truth.

## Review contract

State the user problem, evidence, recommendation, trade-off, and verification.
For visible changes, compare before/after captures and report unresolved risks.
