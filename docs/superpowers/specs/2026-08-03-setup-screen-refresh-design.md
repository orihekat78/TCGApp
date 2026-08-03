# SETUP Screen Refresh Design

## Objective

Match the approved versus-stage reference while retaining every shipped setup
contract. HOME and SETUP share one primary header. The layout targets desktop
and horizontal compact `851x393`; portrait mobile is out of scope.

## Composition

- One centered setup stage: player on the left, real controls in the center,
  CPU on the right.
- Each side shows saved deck name plus actual partner and incident card art and
  formal card names. Incident art always uses `object-fit: contain` because
  both portrait and landscape prints exist.
- Both sides open the same provisional deck picker. Confirm changes only the
  requested side; Escape/cancel restores focus and changes nothing.
- Footer keeps Back and Start visible. Compact landscape scales the approved
  composition instead of replacing it.

## Behavior contracts

- Preserve solo/observe ownership, spectator state, metadata, tutorial exit,
  immediate MATCH navigation, guarded async start, stale-result rejection,
  swap, randomize, first-player mapping, and the public BUG-274 fixture.
- CPU difficulty has no engine setting. Show `ノーマル（固定）` as status,
  never as an interactive control.
- Invalid decks cannot be confirmed. Start errors use an `aria-live` status
  and return to SETUP without removing retry access.

## Acceptance

- No horizontal overflow or clipping at `1440x900` and `851x393`.
- Shared navigation order and active state match HOME exactly.
- Public actual-click flows for normal start, reverse deck binding, and
  BUG-274 continue to pass.
