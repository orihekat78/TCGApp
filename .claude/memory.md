# 作業ログ — 名探偵コナンTCG プロジェクト

> 過去の詳細は `.claude/sessions/YYYY-MM-DD.md` / `.claude/bugs/BUG-*.md` / `.claude/changelog-entries/`。

## 現在の状態 (2026-06-04)

直近セッション: **ルール準拠改善 3 タスク完了** (詳細 → [sessions/2026-06-04.md](sessions/2026-06-04.md))。

- **Task1 switch-on-effect-enter** (rules/20): 現場満杯の効果登場で human にスイッチ提供。
  engine (sceneEnter switchEnter) + apply-pick threading + UI (Playmat→SceneSwitchPickerModal, z-index 1700)。
- **Task2 effective-value filter** (rules/15,19,22): 数値フィルタ (apMax/lpMax 等) を有効値 (turnEffects±修正込み)
  判定に修正 (matchOneFilter)。D11012「LP0の」= lpMin:0,lpMax:0。裁定: 「LP0の」=有効 LP ちょうど 0。
- **Task3** rules/01〜30 準拠監査 → 全変更矛盾なし ([AUDIT-2026-06-04-rules-compliance.md](bugs/AUDIT-2026-06-04-rules-compliance.md))。
- 前段: BUG-106〜110 敵対的レビュー + hardening (#1〜6, review-hardening.test.ts)。

### 検証 (最終)
tsc clean / vitest **1703 PASS** / smoke1000 例外0・baseline 不変 (10.86/469) / e2e 65 PASS /
Task1 実機 Playwright 確認済。

### 未解決 (latent、現 MVP プレイに無影響・deferred)
- BUG-111 (pick↔continuation FIFO desync, multi-step) / BUG-112 (off-board char の declared limit 未追跡) /
  BUG-113 (filter の continuousDelta=dyn AP 残差, D08005 のみ)。

### ⚠ 未 commit
harness 規約で commit/push は user 指示待ち。commit 前に `npm run docs` (docs:check hook) が必要。
新規ファイル: review-hardening / switch-on-effect-enter / effective-value-filter テスト + BUG-106〜113 +
changelog 2026-06-03-10〜12 / 2026-06-04-01〜02 + AUDIT 2 件。
