# SETUP Screen Refresh Design

## Objective

Match the approved versus-stage reference while retaining every shipped setup
contract. HOME and SETUP share one primary header. The layout targets desktop
and horizontal compact `851x393`; portrait mobile is out of scope.

## Composition

- One centered setup stage: player on the left, three compact dropdown rows in
  the center, CPU on the right. The redundant `VS` label is omitted.
- The center uses the approved separated-row direction. It has no enclosing
  outer panel. Each row has a restrained line icon, label, selected value, and
  chevron. Play mode uses a gamepad, first player uses a die, and CPU
  difficulty uses a robot. Icons remain secondary to text.
- The start action sits directly below CPU difficulty as the endpoint of the
  center column. It is not repeated in a footer. The Back action is removed.
- Each side shows the saved deck name, actual partner-card art, partner name,
  and incident name. The three text rows sit below the partner art.
  Incident-card art is intentionally omitted.
- Both sides open the same provisional deck picker. Confirm changes only the
  requested side; Escape/cancel restores focus and changes nothing.
- Desktop and compact landscape use the same labels and composition. The
  `851x393` layout scales typography and spacing while keeping every control at
  least 44px high.

## Behavior contracts

- Preserve solo/observe ownership, spectator state, metadata, tutorial exit,
  immediate MATCH navigation, guarded async start, stale-result rejection,
  first-player mapping, and the public BUG-274 fixture.
- In observe mode, use `CPU 1` and `CPU 2` consistently for both seats,
  first-player options, and deck-change accessible names.
- Play mode and first player use native dropdowns. CPU difficulty has no engine
  setting, so it uses a disabled one-option dropdown showing `ノーマル`.
- Remove the deck-swap and random-selection helpers. Each side retains its own
  explicit deck-change action.
- Invalid decks cannot be confirmed. Start errors use an `aria-live` status
  and return to SETUP without removing retry access.

## Acceptance

- No horizontal overflow or clipping at `1440x900` and `851x393`.
- Start is a direct child of the center controls, below CPU difficulty. No Back
  button or bottom action footer is rendered.
- The robot icon communicates CPU difficulty without replacing its text label.
- Shared navigation order and active state match HOME exactly.
- Public actual-click flows for normal start, reverse deck binding, and
  BUG-274 continue to pass.
