# Mobile Catalog Performance and Landscape Design
## Goal

Stop smartphone crashes on DECK/CARDS, reduce initial HOME work, and keep the
entire authenticated app in a usable landscape presentation.

## Confirmed baseline

- DECK currently mounts 1,806 card tiles and 1,832 image elements at once.
- A short mobile DECK visit decoded about 55 MB of card images.
- CARDS uses the same unbounded mapping pattern.
- The private artifact contains only the Meta app, not a second legacy site.
- All ten routes, the match UI, the engine, and all card modules are currently
  included in one application chunk.

## Catalog rendering

DECK and CARDS keep the complete lightweight metadata array for local search,
filtering, sorting, deck limits, and result counts. They do not mount that full
array.

A shared window-range hook divides results into chunks of 48. The first render
mounts one chunk. Scrolling mounts the intersecting chunk and at most one
adjacent chunk, so no more than 96 card tiles exist. Distant chunks are replaced
by measured top and bottom spacers to preserve scroll position and scrollbar
size. Images only exist for mounted tiles.

Column count and row height are recalculated with `ResizeObserver`. A filter,
sort, view-mode, or result-count change resets the window to the first result.
Selection remains keyed by card number. Keyboard selection first scrolls the
target into the active window, then restores focus. Screen readers receive the
full result count and the mounted result range.

Do not use append-only infinite scrolling, `content-visibility` alone, or a new
virtualization dependency. Those approaches retain the eventual memory failure
or expand the release supply-chain surface.

## Initial-load isolation

HOME remains the eager route. Other screens load through route-level dynamic
imports and a shared loading/error boundary. HOME uses a small partner/case
summary index instead of importing the complete card catalog.

Card registration and match-only modules load when SETUP, MATCH, REPLAY, or
TUTORIAL needs the game runtime. DECK and CARDS load their catalog chunk only
after navigation. A failed route chunk shows retry and HOME actions without a
reload loop.

The private-release manifest, source audit, artifact closure, and prepared E2E
checks must validate every emitted dynamic chunk. No unreferenced legacy entry
or `dist-meta` output may enter staging.

## Landscape behavior

A top-level landscape gate covers HOME, SETUP, MATCH, DECK, CARDS, HISTORY,
REPLAY, TUTORIAL, SETTINGS, and RESULT.

On an initial portrait visit, route content is not mounted. After a route has
mounted once, portrait mode keeps it mounted but inert and hidden behind the
gate so local drafts survive. The gate explains that landscape is required and
offers one button. That gesture requests fullscreen, then calls
`screen.orientation.lock('landscape')` when supported. Rejection leaves the gate
visible and asks the user to enable auto-rotate and turn the device.

Returning to portrait restores the gate. Returning to landscape resumes the
same deck draft, picker, match, or replay state. The gate respects safe-area
insets, keyboard focus, reduced motion, and exact `851x393` landscape compact
layout. It never claims that browser orientation lock is guaranteed.

## Error and state rules

- Offscreen unmounting never changes card filters, favorites, deck contents, or
  unsaved-navigation protection.
- Image failures retain the existing card-art fallback.
- Route-load retry never starts a second match session.
- Orientation changes never dispatch engine actions or clear pending decisions.
- Fullscreen/orientation rejection is a recoverable UI state, not an exception.

## Verification contract

- Unit tests prove range calculation, 48-item initial mount, 96-item ceiling,
  resize, filter reset, and keyboard materialization.
- Component tests prove DECK and CARDS unmount distant cards while retaining
  selection and draft state.
- Production Playwright proves `#deck` and `#cards` stay below 96 mounted tiles
  during start/middle/end scrolling with zero console or page errors.
- Bundle tests prove HOME does not fetch DECK, CARDS, MATCH, or engine chunks
  before navigation and that navigation fetches only the requested dependency.
- Orientation tests cover portrait gate, landscape restoration, lock success,
  lock rejection, fullscreen rejection, state preservation, keyboard access,
  and `851x393` on Chromium plus the iPhone-compatible fallback path.
- Final gates include focused tests, Meta tests, typecheck, lint, full Vitest,
  full relevant Playwright, adversarial UI/release review, private-hosted final
  qualification, exact-staging deployment, and authenticated smartphone smoke.

## Non-goals

- A portrait redesign of the playmat.
- Public hosting, PWA installation as a requirement, or bundled card images.
- Changing game rules, deck legality, card identities, or engine outcomes.
