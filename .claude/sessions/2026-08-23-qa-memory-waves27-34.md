# QA runtime memory rotation: Waves27-34

## Waves27-30

- Waves27-29 certified 24 effect-entry QA. BUG-325 restricts B04030/P to the
  printed 怪盗キッド name.
- Wave30 certified 17 deck-look zero-choice QA. Public paths cover eligible
  decline, mandatory tails, cleanup, and private/public selected-card scope.
- B10068/B10101 publish only the selected card, never the private look window.

## Wave31

- Eight effect-entry paths prove effect-entered characters resolve their normal
  enter triggers with exact filters, optional/zero branches, and cleanup.

## Wave32

- B01023/P and D10024 public look/set/privacy/refresh paths were certified.
- Contact order now uses post-effect AP and terminates without an action window
  if a participant leaves during `contact:start`.

## Wave33

- Twelve QA across sixteen printings prove stacked cards are count-only, not
  scene characters, and do not expose names, traits, colors, or abilities.
- BUG-326 preserves exact stacked physical identity through JSON and host leave.

## Wave34

- Twelve set-card lifecycle QA were certified across 23 printings.
- BUG-327 restores B02067/P's omitted red-character set effect.
- BUG-328 gives each physical set-card occurrence independent turn-use identity
  through pending authority, JSON, replay, and UI selection.

Later records: `.claude/sessions/2026-08-23-qa-wave35.md` and consecutive
Waves36-49 session files.
