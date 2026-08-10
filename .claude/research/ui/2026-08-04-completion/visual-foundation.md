# Visual foundation: observed implementation

Scope: `meta-app/src/styles/meta.css`, screen CSS, `Wave2Motion.css`, and
`src/ui/styles/tokens.css`. Values below are observed, not proposed tokens.

| Foundation | Current evidence |
| --- | --- |
| Typography | Meta UI: `'Hiragino Sans', 'Yu Gothic UI', 'Noto Sans JP', -apple-system, sans-serif`; base foreground `#e0ecf8`. HOME nav is 14px/650; section title 17px; metadata commonly 11–13px. |
| Grid | HOME: 72px header, 28px page padding, `minmax(240px,1fr) minmax(0,4fr)`, 28px gap. SETUP uses three columns; cards use grid/list work areas. |
| Spacing/density | Repeated 4/5/7/8/10/12/14/16/28px gaps. Compact density reduces settings padding to 12–20px, cards workspace to 8px and card-grid gap to `10px 8px`; it does not alter route-shell geometry. |
| Surfaces | Noir base `#0a1a28`; HOME uses `#061321`/`#0a1b2c`, translucent header `rgba(4,15,26,.96)`, 1px low-contrast lines, 4–10px corners. |
| States | Global focus is 2px gold `#ffd700`; selected HOME route is cyan `#43d5f2`. Engine tokens: valid target `#44dd99`, invalid `rgba(238,80,80,.5)`, sleep/stun/named overlays, editing `#3366ff`, resolved `#ee2255`. |
| Icons/controls | Header uses icons plus labels. Normal controls target 44px+ (`home-brand`, dialogs, setup); dense landscape rules retain 44px actions where feasible. |
| Motion | HOME emphasized start transition is 160ms; screen fade is supplied by `MetaShell`. Presentation has slow/standard/fast phase timing. `prefers-reduced-motion` disables or collapses animation/transition in meta, cards, Wave2, and presentation UI. |
| Card resilience | Default art is `object-fit: cover`; known portrait/landscape incident and preview cases use `.meta-card-art--contain`. Native ratio is preserved in card grids; overflow areas use bounded scrolling. |

## Exception ledger

- `#match` remains the dense engine playmat with its own `src/ui` token set;
  do not force Meta-screen surface geometry onto it.
- HOME retains a 20/80 rail/stage composition and fixed headings with independent
  list scrolling. Its start control is intentionally visually stronger.
- Landscape 851×393 has route-specific header/work-area rules; do not infer a
  single mobile breakpoint from desktop values.
- Reduced-motion rules also remove transforms/filter/backdrop-filter in wave-2
  screens. A new animation must have an equivalent static state.
