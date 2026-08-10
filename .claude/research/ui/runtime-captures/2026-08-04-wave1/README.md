# Wave 1 runtime visual acceptance

## Result

GO. Final CSS applied. Runtime captured from fresh `127.0.0.1:5314`.

## CARDS

- `cards-1440x900.png`
- `cards-1280x800.png`
- `cards-1024x768.png`
- `cards-851x393.png`
- `cards-720x393.png`
- `cards-851-filter.png`
- `cards-851-focus-gold.png`
- `cards-851-focus-cyan.png`

## DECK

- `deck-1440x900.png`
- `deck-1280x800.png`
- `deck-1024-detail.png`
- `deck-851x393.png`
- `deck-851-filter.png`
- `deck-720x393.png`

## Measured evidence

- CARDS: no document horizontal overflow at all five widths.
- CARDS: 851/720 header 54px; seven nav controls 44px high and 10px text.
- CARDS: 720 grid keeps five columns; 851 keeps seven columns.
- CARDS: filter drawer stays inside 851x393 viewport.
- CARDS: selected focus is gold; unselected focus is cyan.
- DECK: no document horizontal overflow at all five widths.
- DECK: 851/720 header 54px; toolbar and save labels are at least 10px.
- DECK: 1024 detail layer ends at x=656; pool begins at x=668.
- DECK: 851 filter drawer stays inside the viewport.
- Console warning/error count: zero for both routes.

## Visual review

- No control overlap or clipping found.
- CARDS detail remains on the right; grid remains the primary surface.
- DECK main and pool stay side by side in landscape compact layouts.
- Cyan scrollbar treatment is consistent across the reviewed surfaces.
