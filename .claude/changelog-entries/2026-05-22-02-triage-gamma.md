## user_request 20260521_01 triage Phase γ — 1 試合通し E2E + spectator stall (2026-05-22)

BUG-045 として user_request #9 + 観察「コンタクトでカットインポップアップで
止まる」を一括対応。E2E で更に engine bug 2 件発覚 → 即修正。

### Added
- `tests/e2e/full-match.spec.ts` — spectator mode で mulligan → 終局 (or
  max-turn) まで一貫検証する 1 試合通し E2E。今後の「Playmat 配線漏れ」
  pattern 予防

### Fixed
- BUG-045 spectator AI vs AI で contact 発生時 cutin/guard modal hang →
  `useContactFlowDriver` に `spectatorMode` 委譲を追加、self も AI 判定
- engine `deckRevealUntil` atom: filter object を function として呼んでいた
  `TypeError: filter is not a function` → TargetFilter → predicate 変換 helper
- engine `discard` atom: target pick query を string[] 扱いで
  `TypeError: ids is not iterable` → 防御 skip (本格対応は別 BUG)

### Notes
- Playwright headed: spectator AI vs AI で turn 12 / winner=self / console
  errors 0 で正常完了
- smoke 1000 maintained: avg 11.19 / 0 timeout / 0 exception
- engine 2 bug は smoke では到達しない atom path、E2E が初めて検出
