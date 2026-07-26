# Next Task: Detail magnifier navigation audit

Work from updated `main` after the CT-P10 checkpoint commit.

## Goal

Make every match-screen card-detail entry consistent and unambiguous.

1. A card has exactly one visible magnifier, placed inside its card image at top-right.
2. No visible `detail` / `詳細` label or separate side/bottom detail control remains.
3. Card body clicks retain game actions only; magnifier alone opens a card detail modal.
4. Set-card counts remain a separate, non-overlapping control. It opens the privacy-filtered set list; it is not a second magnifier.
5. Keep a usable hit target, desktop and `851×393` landscape containment, and zero console errors.

## Scope

- Start with `SceneArea`, `CardListModal`, `HandZone`, `FileArea`, `EvidenceArea`, partner/case areas, selection modals, and log card links.
- Search all detail/expand controls before editing. Do not add duplicate controls to solve one flow.
- Preserve private opponent information: only public face-up set cards are inspectable.

## Required evidence

- Add focused UI assertions: exactly one magnifier per card; no visible text detail control; card-body click does not expand; set control does not overlap the magnifier.
- Run relevant Vitest and Playwright on desktop plus `851×393` landscape, including click outcomes and console errors.
- Record horizontal findings in `.claude/memory.md`; create a BUG ticket only for a confirmed behavioral defect.
