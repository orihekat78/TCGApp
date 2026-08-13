# iPhone SE 3 Landscape Visual QA

## Verdict

Chromium viewport evidence passes the documented compact HOME checks. The
current UI is legible and contained at `851x393` and `667x375`. This is not a
physical-iPhone approval.

## Provenance

- Before: detached, clean temporary worktree at `502bd45c`, the parent of the
  first Wave 1 compact-sync commit `61d7c358`.
- After: fresh public `/#home` renders from the authority worktree at
  `25ebc017` plus the current uncommitted Wave 1 landscape and compact-type
  changes.
- Both renders used separate loopback Vite ports and Chromium with animations
  disabled. Each capture had zero console errors and zero page errors.

| Artifact | PNG dimensions | Render facts |
|---|---:|---|
| `before-851x393.png` | 851x393 | 2 identity cards; historical status is not a `.cloud-sync-indicator` |
| `before-667x375.png` | 667x375 | 2 identity cards; historical status is not a `.cloud-sync-indicator` |
| `after-851x393.png` | 851x393 | 2 identity cards; visible `OFFLINE · ローカル動作` pill |
| `after-667x375.png` | 667x375 | 2 identity cards; visible `OFFLINE · ローカル動作` pill |

All four renders had `scrollWidth === clientWidth`; their PNG headers match the
named viewport dimensions. The before files are genuine historical renders, not
reconstructed mockups. Their uncontained bottom status treatment is retained as
the comparison evidence.

## Visual review

- Hierarchy: header/navigation remains scanable; HOME deck identity cards carry
  the primary visual weight; the sync state stays secondary.
- Containment: current partner/case art is fully visible and the page has no
  horizontal overflow at either compact viewport.
- Safe area and legibility: the compact status pill is inside the viewport and
  visibly distinct from identity-card captions. Its full semantic state remains
  available through the status accessibility label.
- Compact layout: current `667x375` preserves HOME identity, deck-change
  control, navigation, and visible sync state without clipped fixed controls.
- Typography: HOME navigation scales from `11px` at `851x393` to `10px` at
  `667x375`; the deck heading scales `18px` to `16px`, and the change-deck
  label `11px` to `10px`. CARDS/DECK actionable labels also shrink while
  retaining their `10px` minimum and `44px` hit targets.
- Safari inflation guard: the document declares `text-size-adjust: 100%` and
  `-webkit-text-size-adjust: 100%`.

## Related current gates

- Landscape hook RED/GREEN: 21 tests green.
- Focused UI regression wave: 174 tests green.
- Public Chromium HOME/CARDS/DECK typography and layout: 34/34 green.
- Public Chromium MATCH surrender at three widths: 3/3 green.
- Desktop Playwright WebKit typography/cloud-sync: 2/2 green.
- Independent UX review: PASS, 38 unit checks plus 5 Playwright checks.

## Documentation and diff checks

- PNG header/dimension and DOM-content checks: PASS for all four artifacts.
- `git diff --check` and `git diff --check origin/main...HEAD`: PASS.
- `npm run docs:check`: BLOCKED; only generated
  `.claude/auto/progress/tests.md` would change, due concurrent unowned test
  work. This lane did not regenerate or stage that file.

## Evidence boundary

Chromium simulation and desktop WebKit do not prove iPhone Safari behavior.
No physical iPhone SE 3 Safari run was available; the required device smoke
through HOME, DECK, MATCH surrender, and RESULT remains unverified. The UI
therefore makes no claim that iOS accepted an orientation lock or that final
device-release certification is complete.
