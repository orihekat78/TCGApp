# CARDS scrollbar design

Date: 2026-08-03
Status: approved direction; awaiting written-spec review

## Goal

Replace native-looking scrollbars on the CARDS screen with the same visual
treatment already used by HOME's official NEWS and recent-match lists.

## Visual contract

- Reuse the HOME values without introducing a CARDS-specific variation.
- Firefox: `scrollbar-width: thin` and
  `scrollbar-color: rgba(121, 212, 236, 0.55) transparent`.
- WebKit: 5px vertical and horizontal tracks, transparent track, cyan thumb
  at `rgba(121, 212, 236, 0.55)`, and a fully rounded thumb.
- Preserve the existing browser end markers shown by the HOME scrollbar.
- Do not add gold, glow, shadows, or new motion.

## Scope

Apply the shared treatment to every user-scrollable CARDS region:

- card grid and list;
- selected-card details;
- filter drawer contents.

HOME behavior and all scrolling mechanics remain unchanged. No changes to
card ordering, dimensions, filters, keyboard focus, or responsive layout.

## Same-card print selector

- Place the selector immediately above the card name and identity details.
- Show every linked print as a compact card-number chip; omit the
  `別イラスト` micro-label.
- Use the approved cyan active chip and subdued inactive chips.
- Wrap all print chips onto additional rows. Do not use a next button,
  horizontal scrollbar, clipping, or automatic horizontal scrolling.
- Clicking a numbered chip keeps the existing behavior: select that print and
  replace the displayed card image and metadata.
- Preserve `aria-pressed`, keyboard focus visibility, and a 24px minimum target
  on every chip. Pointer selection must not retain an outer focus rectangle.

## Selected-card effect copy

- Keep the effect text unchanged.
- Remove the visible `EFFECT · 効果` heading above it.

## Selected-card stats

- Partner: show LP only; omit cost and AP.
- Incident: omit cost, AP, and LP; show the official card-specific first-player
  and second-player card counts in the same stat area. `B09107P` is `0 / 0`.
- Event: show cost only; omit AP and LP.
- Character and other applicable card types keep their current stats.

## Verification

- Add a failing browser assertion for HOME/CARDS scrollbar parity before CSS.
- Check desktop and `851x393` with filter drawer open.
- Confirm vertical regions still scroll and the print selector has no nested
  horizontal overflow.
- Confirm every chip is visible and directly replaces the selected print.
- Confirm effect text remains visible without the `EFFECT · 効果` heading.
- Confirm every card kind exposes only its applicable stats.
- Run focused CARDS tests, typecheck, lint, build, and diff check.
- Confirm zero browser console errors.
