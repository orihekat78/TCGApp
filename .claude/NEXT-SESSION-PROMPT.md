# 次セッション再開プロンプト (2026-06-16 BUG-111 #2 根本修正 + 解禁2枚出荷 完了 — ALL_CARDS 1301)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-16、BUG-111 #2 修正 + 解禁2枚出荷 完了、HEAD≈8286f2c3、ALL_CARDS=1301)

直近セッションで以下を完遂 (全 commit CI green):
- **engine 修正 a682b20b**: BUG-111 #2 (human-decline 経路の sequence mandatory-tail drop) を根本修正。
  continuation に origin `kind:'sequence'|'chain'` を付与し、decline 時に sequence-origin は remainder 実行・chain-origin は drop。
  `applyPickSkipAndContinuation(.., runDeclinedAtom=false)` で declined head atom 非再実行。engine 4ファイル、骨格凍結例外。
  **B05028 over-fire は誤診断**と判明 (再現せず、5 シナリオ独立検証)。spec: `.claude/specs/bug-111-human-decline-fix-design.md`。
- **card 出荷 8286f2c3**: 解禁 2 rep + clones = 4枚 (B05028/B05028P/B09038/B09038P)、ALL_CARDS 1297→1301、engine変更0。
  gate5 実機: B05028 11 pass (chain-gate decline=step2不発火) / B09038 9 pass (★0登場 decline で draw 発火 + falsification 実証)。
- 全gate green: validate-specs pass=45 / tsc / full vitest 2560 / smoke baseline byte同一 / playwright 119 / lint:* 8本 / CI ×3 green。

## 残: B09056 DEFER 継続
B09056 の末尾は 2択 `choice`。choice-in-continuation の eager-surface (BUG-145 系、optional wrapper 未達でも surface する fragile 挙動) が
未整備のため DEFER 継続 (BUG-111 #2 の underfire 自体は修正済)。

## ★最優先候補 (いずれか)

1. **トリアージ出荷バッチ#5**: window6+ 抽出 (`node scripts/survey/sweep-window2.cjs <greenN>`、done 186 除外、green-only) →
   certify (`Workflow scriptPath: scripts/wf-certify.mjs`, `model:'opus'`, SUB=5, **1 workflow ずつ**) → 出荷。
   fresh green pool ≈ 170 sig。パイプライン = certify → `verify-clone-identity.cjs` → `build-verified-codegen-input.cjs` →
   `taskA-codegen.cjs --write` → `taskA-register.cjs` → gate5 (`wf-gate5-batch4.mjs` 流用 or 手書き) → 全gate。
2. **中型 engine クラスタ** (骨格凍結例外 + opus 敵対設計レビュー + 全gate): cutin-subtype filter (69枚) /
   grant-textual+set-card→host (60) / contact-removal-by-self (51) / dynamic-count (~45)。
3. **choice-in-continuation surface gap 修正** (B09056 等の解禁前提): sequence remainder の choice/optional を eager-surface でなく
   正しく surface する engine 整備 (BUG-145 系)。要 opus 設計レビュー。

## プロセス必須
- certify/難判断/gate5-author agent は `model:'opus'`。engine 変更は骨格凍結例外 + opus 敵対設計レビュー + 全gate。
- 1 タスク = 1 独立コミット。docs commit は `.tmp/certify` durable を消さず `npm run docs`。push は branch→main ff-merge (分割実行)。
- ⚠ Workflow 並列は SUB=5 程度に throttle、1 workflow ずつ (高並列 + 別workflow 同時で server rate-limit 実害)。
- smoke レポート (.claude/reports/smoke-*) は commit 対象外 (git add -A 後に `git reset .claude/reports/`)。
- Read hook がファイルを line1 で切る → Bash `cat -n` で読む / Edit 前に Read 1 回で登録。
- 出荷後の card-wave: codegen の罠 (case:to-resolved 等の closure matcher → 共有 factory 手動差替え)。

## 状態 doc
- BUG-111: `.claude/bugs/BUG-111.md` (#2 = 修正済 + 誤診断訂正) / spec `.claude/specs/bug-111-human-decline-fix-design.md`
- defer: `.claude/specs/DEFERRED-INDEX.md` (B05028/B09038 解禁済、B09056 DEFER 継続)
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` / bug: .claude/bugs/index.base
- 詳細: memory.md セッション⑮ + sessions/2026-06-16.md
```

直近セッションは BUG-111 #2 を engine 根本修正 + 解禁2枚 (B05028/B09038 +clones=4枚) を card-wave 出荷まで完遂 (CI green ×3)。
B05028 over-fire は誤診断、B09038 は修正で draw 発火、B09056 は choice-surface gap で DEFER 継続。
**次セッションはトリアージ出荷バッチ#5 (window6+) or 中型 engine クラスタ or choice-surface gap 修正。** `/clear` で新セッション推奨。
