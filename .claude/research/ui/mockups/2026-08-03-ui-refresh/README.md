# UI refresh reviewed mock set

## Review targets

Each PNG contains one route or one MATCH state. Desktop is 1440x900. Mobile is landscape 851x393.

- `match-desktop-real-dom-causal-draw.png`: actual MATCH DOM at 1440x900 with a transient causal overlay.
- `match-mobile-851x393-uniform-canvas-resolution-reviewed.png`: resolution state. The complete desktop MATCH canvas is uniformly scaled; native rails carry status and actions.
- `match-mobile-851x393-uniform-canvas-target-selection-reviewed.png`: target-selection state. The same central playmat remains visible while the native right rail becomes the picker.
- The two mobile MATCH central regions are RGBA-identical across 247,197 pixels. MATCH passed mock adversarial review.
- `result-desktop-1440x900-reviewed.png` / `result-mobile-851x393-reviewed.png`: result, end reason, scores, confirmed card, and three next actions.
- `history-desktop-1440x900-reviewed.png` / `history-mobile-851x393-reviewed.png`: content-height history list, cyan filters, and explicit replay actions.
- `replay-desktop-1440x900-reviewed.png` / `replay-mobile-851x393-reviewed.png`: preserved playmat context with native replay controls.
- `tutorial-desktop-1440x900-reviewed.png` / `tutorial-mobile-851x393-reviewed.png`: L0-L13 learning path and the current lesson.
- `settings-desktop-1440x900-reviewed.png` / `settings-mobile-851x393-reviewed.png`: initial settings direction; mobile settings content scrolls inside its panel.
- `home-*-implemented.png` / `setup-*-implemented.png`: current approved implementations.
- `cards-*-implemented.png`: current implementation; compact grid is seven columns at 851x393.
- `deck-*-implemented.png`: current implementation with deck/pool drag-and-drop workspace.

The five reviewed HTML sources pass ten viewport checks: no horizontal overflow, no image-load or console failure, and no visible interactive target below 44px. This is mock evidence, not runtime acceptance.

Final independent product-design and UX reviews are GO. Critical and Important findings are zero across the 13-image static handoff.

Runtime gates remain causal UID binding, disabled semantics, focus restoration, presentation-only skip, persisted setting consumers, replay reconstruction, and deterministic GameState equivalence.

## Rejected artifacts

- `match-desktop-causal-draw.png` and `match-mobile-851x393-causal-draw.png` are rejected image-generation drafts. They redraw the playmat and are not implementation references.
- `match-mobile-851x393-real-dom-causal-draw.png` keeps the real DOM but lets responsive rules reflow it. It is rejected for the stricter desktop-canvas-preservation requirement.
- `match-mobile-851x393-uniform-canvas-concept.png` proves the geometry only. Its scaled internal controls are not an interaction reference.
- Old `result-*concept*`, `replay-*concept*`, and `tutorial-*concept*` files are superseded by the reviewed files above.
- `history-*-implemented.png` and `settings-*-implemented.png` remain baseline captures, not the renewed mock reference.

Unapproved concepts must not be implemented until the user reviews each screen.
