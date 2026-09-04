## QA Wave 31 — effect-entry enter triggers

- Added public-runtime witnesses for eight official QA records covering characters entered by abilities and effects.
- Proved normal 【登場時】 triggers fire after real `sceneEnter` resolution for remove-area and hand sources.
- Covered target filters, source ownership/splice, sleep entry, self-sleep, optional decline, zero discard/entry, causal order, and cleanup.
- Grounded B03085, B06018, B06052, B06090, B09048, B09057, PR138, and PR144 against pinned official TSV rows.
- No shipped CardDef or engine change was required.
- Advanced exact official-QA coverage from 1,175 to 1,183 matched records; test-missing falls from 1,789 to 1,781.
