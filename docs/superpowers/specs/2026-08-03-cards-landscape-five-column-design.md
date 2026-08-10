# CARDS Landscape Compact-Grid Design

> Updated by the later approved direction: 851x393 uses seven columns. Widths at
> 720px and below keep five columns to avoid the previously observed collapse.

## Goal

At supported compact landscape widths (`667px` through `900px`), show five or
seven cards across according to available width while keeping the
selected-card inspector readable, actionable, and fully contained in the viewport.

## Approved Direction

- Preserve `PrimaryHeader`, toolbar order, navy surfaces, and the desktop layout.
- Keep the landscape workspace split between the card grid and a `240px` inspector.
- In landscape compact mode, use seven equal columns from 721px through 900px.
- At 720px and below, keep five equal columns to preserve the inspector and controls.
- Wider desktop layouts may add columns automatically.
- Keep each card's natural portrait or landscape ratio; do not crop card art.
- Replace the current transformed thumbnail with a stable `140x115px` art stage.
- Render landscape inspector art at `140x101px` and portrait art at `82x115px`.
- Keep identity, print variants, kind-specific stats, effect, and favorite action
  in the same order as the CARDS desktop inspector.
- Keep the selected card name, current print, and visible `別イラスト (N)` context
  available without scrolling the inspector.
- Keep the inspector body independently scrollable and its favorite action fixed.
- Do not introduce new panels, decoration, labels, or horizontal scrolling.

## Responsive Contract

- Seven columns apply from `721px` through `900px`; five columns apply at 720px
  and below. Cards may shrink below normal width but preserve their natural ratio.
- At `851x393`, the first seven cards remain on one row; at `1440x900`, the first
  eight cards remain on the first row.
- Large and list view controls remain usable and retain their existing semantics.
- The screen, workspace, card grid, toolbar, and inspector must not overflow
  `851x393` or `667x375`.
- Shared navigation must remain inside its header allocation and never cover CARDS.
- Search and every enabled print chip expose at least a `44x44px` hit area.
- Keyboard selection, print navigation, filter focus handling, and reduced motion
  retain their current behavior.

## Visual System

- Palette remains deep navy, cyan interaction, gold favorite, red invalid state.
- Existing Japanese/body and mono/data typography remains unchanged.
- Signature: a dense seven-card visual shelf at 851x393 paired with a readable inspector.

## Acceptance Evidence

- Playwright proves seven grid items share the first row at `851x393`.
- Inspector landscape art is at least `110px` wide; portrait art keeps a taller ratio.
- Every selected-card image uses `contain`, loads successfully, and stays inside
  its stable art stage without cropping.
- Page horizontal and vertical overflow are zero.
- At `667x375`, the header does not intercept card-grid or inspector interactions.
- Search and print variants retain `44px` touch targets in both compact viewports.
- Selected identity and current print are visible before inspector scrolling.
- Desktop card sizing and layout remain unchanged.
- Browser console and page errors are zero at desktop, `851x393`, and `667x375`.
