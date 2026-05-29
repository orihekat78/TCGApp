---
date: 2026-05-28
title: Phase 13 — 残り 7 画面を元モック忠実に rebuild (HOME / SETUP / RESULT / DECK / HISTORY / TUTORIAL / SETTINGS / REPLAY)
type: feat
scope: meta-app
---

## ユーザー指示

> 他モックについても同様にお願いします

Phase 12 で CardsScreen を `design-mockups_v2/08-cards.jsx` 忠実版に書き直した実績を、残り 7 画面に横展開。`src/` は完全不変、Phase 11 統合 (SetupScreen → performGameStart、ResultScreen → gameState 直読) は壊さず維持。

## 画面別 rebuild

| 画面 | 旧 LOC | 新 LOC | 主要追加要素 |
|---|---|---|---|
| ResultScreen   | 208 | 350+ | ResultBackdrop (radial bloom + light rays + 40 particle dots) / Verdict 巨大 JP + VICTORY 装飾 / MVPShowcase (gradient + ⭐ + big card + ContribRow x 4) / ResultStats (ScoreSide + 6 StatCompare grid + PROGRESS) / 5 button Actions |
| SetupScreen    | 242 | 350+ | ModeTile (SELECTED badge + ModeAvatar x 2 + desc) / PlayerConfigPanel (P1/P2 + partner + ConfigRow + MiniMetric) / SwapButton / SetupMatchOptions (4 OptionToggle) |
| HomeScreen     | 268 | 420+ | HeroBackdrop (skyline SVG + magnifier watermark + light beam) / CenterHero / HeroPartner (3 カード fan + sparkles) / DuelButton (大型シェブロン) / 強化 Panel 群 |
| DeckEditor     | 237 | 530+ | SubToolbar (rename + Save) / FilterRail / CardListGrid + CardDetailPanel / DeckHeader (40/40) / DeckStats (CostCurve + ColorBar + TypeRow) / DeckList (cost sort + AP + keyword chip) |
| HistoryScreen  | 157 | 360+ | HistorySubToolbar (filter chips + deck select) / WinRateSummary (sparkline 14 戦) / DeckPerformance (実 history 集計) / MatchDetail / OpponentHeatmap (3x5 matchup) |
| TutorialScreen | 224 | 400+ | SubToolbar (進捗 bar) / ChapterProgress (rank) / ChapterList (locked/cleared/current 状態別) / ChapterContent (TutorialStep) / ChapterIllustration (CardDiagram + WARNING + TermRow + POINT) |
| SettingsScreen | 173 | 320+ | Header (戻る/データ削除) / CategoryRail (6 cats + icon) / DetailPanel (visual/play/audio/control/data/about) / SegmentedControl / Toggle / Slider / SystemRightRail |
| ReplayScreen   | 125 | 220+ | BoardZone snapshot (partner + 現場 mock) / Scrubber (⏮◀▶⏭ + progress bar) / ActionLog (turn ごとカラーログ) |

## 不変条件 (絶対遵守、すべて達成)

- ✅ `src/` 配下 1 行も変更なし (`git status -- src/ tsconfig.json vite.config.ts tests/` = 0 件)
- ✅ Phase 11-C SetupScreen 配線保持: `nav('match')` 先実行 → `performGameStart` async → `setGameState`
- ✅ Phase 11-E ResultScreen 配線保持: `gameState` 直読 + `recordedRef` dedup + `setState({ gameState: null })`
- ✅ Phase 12 CardsScreen 動作維持
- ✅ 既存 vitest / playwright e2e 全件無修正で緑 (golden-path の 2 件のテキスト追従修正のみ)

## 検証

- tsc + build green (bundle 600KB 程度)
- meta-app e2e 19/19 全緑 (smoke 10 / golden-path 3 / cards 4 / engine-stub 2)
- 5174 で全 9 画面確認 (HOME → SETUP → 実機対戦 → RESULT → HISTORY → REPLAY 通し動作)

## 仕様 / 記録

- `.claude/specs/meta-ui/12-screens-rebuild.md` 新規 (100 行以内) + `meta-ui/INDEX.md` + `.claude/specs/INDEX.md` 登録
- `.claude/memory.md` 末尾に Phase 13 ログ追記
- F-rule-audit 残課題: TutorialScreen 章 04 で「アシスト勝利不可」図解を完全反映

## 持ち越し (Phase 14+)

- カスタムデッキ → engine DeckSpec 変換 (現状 CT-D08 / CT-D11 専用)
- HistoryScreen の MatchRecord 集計を engine.log ベースに精緻化 (contacts/hirameki/misread)
- ReplayScreen の実盤面再生 (`engine.event.applyUntil` 利用)
- OpponentHeatmap を実 history から動的集計
- バンドル分割 (chunk size warning 解消)
