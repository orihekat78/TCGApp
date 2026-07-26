---
name: conan-design
description: Use when designing, redesigning, visually polishing, or reviewing Conan UI; when judging hierarchy, usability, accessibility, responsive behavior, design systems, screenshots, or visual regressions; or when a vague thematic request could reduce product quality.
---

# Conan Product Design

Read `.codex/design-principles.md`. Improve the real product, not a themed mockup.

1. Inspect the rendered screen, user task, existing tokens, components, and
   structurally similar screens.
2. Translate requests such as "more like Conan" into hierarchy, comprehension,
   tension, state clarity, and content emphasis. Do not introduce detective
   clichés or franchise decoration unless the user explicitly names the exact
   element and accepts its usability trade-off.
3. For a new UI type or redesign, use `product_design_director` before
   implementation. Use `ux_reviewer` for interaction and accessibility.
4. Preserve game contracts and state visibility. Implement with reusable tokens
   and existing component patterns.
5. Use `visual_qa` after implementation. Compare before/after at desktop and
   `851x393`, exercise real interaction, inspect focus and console errors, and
   respect reduced motion.

Report the user problem, evidence, recommendation, trade-off, captures, and
verdict. Do not approve visible work from source inspection alone. Do not rebuild
implemented screens in Figma as the source of truth.
