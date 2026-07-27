# YOU vs CPU human validation

## Phase 0 baseline

- Main: `9e07c596f5f0b0014239bb97d575a0ad59ec1222` (2026-07-27, ff-only)
- UI origin: `http://localhost:5174` / current-worktree IPv6 Vite process
- Public UI roster: 13 entries. Validation roster: N=10; `TEST-*` 3 entries are excluded as test fixtures. Worklist: 55 unordered pairs with mirrors.
- Human rule: select only visible UI controls and visible-card information. No app-state, pending, dispatch, private cards, or set-card inspection.

## Deck index and complete ordered worklist

`row` is the upper-triangular ordering of the 10 validation decks: each pair
once, mirrors included (55 rows). `status` starts `queued`.
The authoritative explicit table is `2026-07-27-you-vs-cpu-human-validation-worklist.csv`.

| index | deck ID | UI name |
|---:|---|---|
| 0 | sample-d08 | 少年探偵団・標準 |
| 1 | sample-d11 | 警察・標準 |
| 2 | deck-1784115364915 | 緑アグロ |
| 3 | deck-1784115404288 | 黒赤デッキ |
| 4 | deck-1784115417710 | 青緑 |
| 5 | deck-1784115431945 | 疾風 |
| 6 | deck-1784115445284 | デッキ破壊 |
| 7 | deck-1784116371260 | TEST-バグ波-緑 (fixture; excluded) |
| 8 | deck-1784116381289 | TEST-コンタクト (fixture; excluded) |
| 9 | deck-1784116391075 | TEST-無制限0627 (fixture; excluded) |
| 10 | deck-1785068468834 | 白黄前髪 |
| 11 | deck-1785077234307 | 黒カットイン |
| 12 | deck-1785077473170 | サッカー |

## Result schema

For every started row record: seed, viewport, first player, visible board,
available actions, chosen action and reason, click result, card/ability source,
owner, chooser, target, changed side, CPU/result re-check, UI findings, and
status (`clean`, `non-clean`, `blocked`, or `rerun-required`).

## Pilot queue

| pilot | row | viewport | YOU | CPU | status |
|---|---:|---|---|---|---|
| P1 | 2 | desktop | sample-d08 | sample-d11 | non-clean (BUG-116 fix; rerun required) |
| P2 | 11 | desktop | sample-d11 | sample-d11 | clean |
| P3 | 1 | 851x393 | sample-d08 | sample-d08 | clean (UI findings logged) |

## P1 decision log (in progress, desktop)

- T1 YOU: visible FILE=1, evidence=0, six hand cards all level-gated. Only legal action was end turn; confirmed it. Result: CPU then reasoned with partner and used D11018; public board became opp evidence=1/6, opp FILE=2, YOU FILE=3.
- T3 YOU: choices were D08017 and D08007 (both level 2); chose D08017 (1000 AP) to establish a character, preserving D08007 for later. Result: `handUseCard`; source=D08017, ability=none resolved, owner=self, chooser=self, target=self scene, changed side=self. Board showed D08017 in scene; log matched.
- T4 CPU: rechecked public board and log. CPU reasoned twice, used D11019, publicly revealed three cards, entered D11016, moved two cards to deck bottom, shuffled. No private card or deck-order information was read.
- T5 YOU: FILE=5; legal hand cards were D08013, D08007, D08023. Chose D08013 (AP 4000) over lower-AP options. Result: source=D08013/a1, owner=self, chooser=self; evidenceGain +1, mandatory evidence-to-hand selected its sole public UI candidate without inspecting its identity, then chose the recovered D08017 (AP 1000, redundant with existing scene copy) for mandatory discard. changed side=self (evidence +1 then remove +1); result log: evidence-to-hand ok and hand remove 1.
- T6 CPU / T7 YOU: CPU publicly used D11014, then log recorded D11014/a2 with `cost-not-paid` warning and a forced self hand-removal. At FILE=7, the sole pending public action was to remove one card. Chose D08007 (AP 1000) over higher-AP alternatives. Result: source=D11014/a2, owner=opp, chooser=self, target=self hand D08007, changed side=self remove +1. Rules require the sleepSelf cost first; ActionContext showed payment occurred but did not retain `costPaid`, confirming BUG-116's residual false-positive. Fixed locally; P1 rerun required.
- T7 YOU: chose public D08019 (AP 5000, level 5) over level-8 gated cards; source=D08019, owner=self, chooser=self, target=self scene, changed side=self scene +1. Its optional state-change prompt did not expose the result state or a beneficial candidate; chose `選ばない`. No action/推理 target was available, so end turn was then the only legal progression.
- T8 CPU: public log recorded D11005 scene removal targeting D08019, three reasoning evidence gains, and another `cost-not-paid` warning. Opponent reached evidence 8/6; no result appeared until its later turn.
- T9 YOU: FILE=9 made level-8 cards legal. Chose D08021 (AP 8000), then selected both public selectable removed cards (D08017, D08007) for its stack effect. D08019 was rendered as `最新リムーブ` with only a detail control and was not selectable. source=D08021/a1, owner=self, chooser=self, targets=D08017,D08007, changed side=self remove -2 / D08021 stack +2.
- Result: P1 row002 ended at T10, YOU defeat / CPU win, reason `必要証拠数達成`; self evidence 0/7, opponent 8/6. Status `non-clean`: (1) BUG-116 false-positive `cost-not-paid` warning fixed, rerun pending; (2) D08021 correctly excludes D08019 because only `[少年探偵団]` removed cards are legal and D08019 has `[発明家]`; (3) opponent crossed the threshold at T8 but result was displayed at T10, still under rules/ActionContext investigation.
- UI: disabled hand cards explain either FILE-level gate or one-use-per-turn. End turn requires a confirmation dialog. Effect log setting on Setup is disabled, but in-match LOG is interactive and exposes actor/action/target/result. Hand-card click opens the hand; actual use is a second click plus confirmation, while magnifier is adjacent and distinct.

## P1 rerun decision log (in progress, desktop)

- Setup was restarted through public controls with the same deck pair. The UI has no public seed control or display; the changed visible opening hand is recorded as a seed-verification limitation, not a same-seed claim.
- T1 YOU: FILE=2. Only Yoshida Ayumi (level 2) was legal; played it. The first card interaction opened the hand, while the use action required the card-name text followed by `Use` and confirmation. Result: self scene +1.
- T3 YOU: FILE=4. Played Kojima Genta (level 3) as the strongest legal hand card. Its mandatory remove-from-hand prompt exposed no CUA-selectable card controls; selected the duplicate public Genta by its visible name to preserve stronger cards. Result: self remove +1 and effect resolved.
- T5 CPU: public board was opp evidence=4/7, FILE=5, with Oe Shinobu visible. Log showed D11012/a1, D11012 hand use, and D11016 reasoning. The board then remained on `Opponent turn processing` with END disabled after 15 seconds; no human choice UI appeared. Source= D11012/a1, owner=opp, chooser=opp, changed side=opp. This confirmed BUG-268.
- UI: generic `safety cap 200 moves` does not identify the pending CPU choice; hand-card operation and magnifier/detail remain easy to confuse. Setup's three disabled effect-log options and absent seed display remain assessment limits; browser history navigation was automation-only, not an app BUG.

## P1 rerun after BUG-268 (desktop)

- T1/T3: all visible hand cards were level-gated; END was the only legal action.
- T5: played D08009 Genta (Lv5). CPU completed after an optional contact prompt; passed because no candidate/rationale was visible.
- T7: selected Haibara for the explicit mandatory hand-removal prompt, then played Conan (Lv7). CPU completed normally; no choice lock.
- T9: played Kessei Shonen Tanteidan (Lv8); selected both public remove candidates, then confirmed END.
- Result: T10 defeat, YOU evidence 0/7; CPU evidence 8/6. Result screen displayed normally. BUG-268 regression passed through public UI.
- Seed limitation: Setup exposes neither seed input nor seed display. Clean public rerun, but not same-seed evidence.

## P2 decision log (desktop, D11 mirror)

- T1: all visible cards were level-gated; END was the only legal action.
- T3: played Oe Shinobu (Lv3/AP3000). T5: played Megure Juzo (Lv5/AP5000).
- T7: an explicit discard effect removed Hagiwara Kenji; then played Matsuda Jinpei (Lv6/AP5000).
- T9: opponent already showed evidence 8/6 but no result yet. Played Yokomizo Jugo (Lv8/AP8000); its optional remove prompt had no explained benefit, so chose `select none`.
- Result: CPU chose incident resolution on T10; YOU lost 0/7 vs CPU 8/6. Evidence threshold alone is not an immediate-result defect.
- UI: effect prompt gave target selection but did not show source, owner, chooser, or expected outcome; decision rationale was therefore under-explained.

## P3 decision log (851x393, D08 mirror)

- Strongest legal sequence: Mitsuhiko Lv2, Ayumi Lv4, Mitsuhiko Lv6, Conan Lv8, Haibara Lv7; CPU D11003/a2 forced Genta AP2000 removal (owner=opp, chooser=self, changed side=self). Conan optional removal passed without benefit. Result T11 YOU 0/6 defeat, CPU 8/7 win; errors/interception/pending=0. Narrow UI compressed setup/overlay and hid prompt context while END was disabled: UI finding, not BUG.

## Row 003 decision log (desktop, D08 vs green aggro)

- T1 all public hand cards were FILE-gated, so END was the only legal action. T2: chose Genta Lv3/AP2000 over Mitsuhiko Lv2; Genta mandatory discard removed lowest-AP Mitsuhiko (AP1000). source=D08009, ability=a1, owner=self, chooser=self, target=self hand, changed side=self remove +1.
- CPU recheck: public board/evidence moved 1/6 then 3/6 then 6/6; CPU used Hattori/`B09030P` and forced a self discard. Chose Ayumi AP4000, retaining AP5000+ cards. source=B09030P/D02003, owner=opp, chooser=self, target=self hand, changed side=self remove +1.
- T4: played Conan Lv7/AP6000 (strongest legal); result T8 YOU defeat 0/7 vs CPU 6/6. Console errors=0, pointer interception=0, no stuck modal/pending at result.

## Row 004 decision log (desktop, D08 vs black-red)

- T1 all hand cards FILE-gated; T2 played Ran Lv3/AP2000 over Ayumi Lv2. T3 only Ayumi Lv2 was eligible. CPU board/evidence rose 1/6, 3/6, 5/6, then 7/6; each public resolution was rechecked.
- CPU forced a discard at FILE7; removed unexplained event `あら…頼もしいじゃない…`, retaining characters. T5 used Conan Lv7/AP6000. T9 played D08021 (AP8000), chose legal distinct removed Haibara and Mitsuhiko stack cards; duplicate Haibara was UI-disabled.
- Result T10 YOU defeat 0/7 vs CPU 7/6. source=D08021/a1, owner=self, chooser=self, targets=Haibara/Mitsuhiko, changed side=self stack +2. Console errors=0, pointer interception=0, no pending/modal at result.
