## user_request 20260521_01 triage Phase δ — #3 contact UX + #12 spectator HUD (2026-05-22)

commits `cc3a605` / `98efb82` / `49a7063` / `4b654fd` / `25589ad` / `f1b3ebc`。
#3 contact UI driver と #12 spectator speed / hand-use heuristic を解決。

### #3 相手ターン中の contact 処理 — verify + UX 改善

- BUG-044 (`5ffed7c`) と BUG-045 (`9169af4`) の修正で構造的に動作することを
  Playwright headed + 既存 vitest (useContactFlowDriver.test.ts) で確定
- `OppTurnOverlay` を強化: activeActionId 中は attacker → target (phase 名)
  を具体表示 (cc3a605)
- E2E spec `tests/e2e/opp-turn-contact.spec.ts` を新規 (98efb82): 3 シナリオ
  (guard modal / cutin modal / case ターゲット表示) で回帰防止

### #12 観戦モード speed + AI 手札使用 改善

- `store.aiSpeedMs` + `SpectatorHUD` 新規: 200/400/800/1500/3000ms の
  5 preset + 現在値表示 (49a7063)
- `store.isAiPaused` + `aiStepCounter` + pause/step ボタン: paused 中は AI
  進行停止、step button で 1 cycle (opp + self) 進める (4b654fd)
- `handUseCard` heuristic を sparse-aware 化: scene < 3 で character を
  AP+LP*1.5 score で優先、scene >= 3 で event 優先 (25589ad)
- E2E spec `tests/e2e/spectator-speed.spec.ts` (f1b3ebc): 3 シナリオ

### Metrics

- smoke 1000 戦: avg 11.19 → 10.64 (アグレッシブ化 / max 19→16 で variance 改善)
  winsA 50% → 51.1% (許容範囲)
- ユニット 1522 PASS / 1 skipped (改修前から +9 tests)
- E2E 48 PASS / 1 skipped (改修前 42 から +6 = 3 opp-turn-contact + 3 spectator-speed)
