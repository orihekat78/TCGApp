# 次セッション再開プロンプト (2026-06-16 BUG-111 #2 根本修正完了 — human-decline 経路の sequence mandatory-tail drop を engine 修正、B05028 誤診断判明)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-16、BUG-111 #2 engine 修正完了、HEAD≈a682b20b、ALL_CARDS=1297)

直近セッションで **BUG-111 #2 (human-decline 経路の sequence mandatory-tail drop) を engine 根本修正** (commit a682b20b、CI green)。
- 修正: continuation に origin `kind:'sequence'|'chain'` を付与。decline 時に sequence-origin は remainder 実行 (rules/15 独立 step)・
  chain-origin は drop (rules/25 gate)。`applyPickSkipAndContinuation(.., runDeclinedAtom=false)` で declined head atom 非再実行。
  engine 4 ファイル (resolve-picks/resolver/apply-pick/useEngineDispatch)、atom-handlers 不変。骨格凍結例外 (engine bug 修正)。
- 検証: repro 5/5 (`tests/engine/effect/bug-111-human-decline-repro.test.ts`) / tsc clean / full vitest 2540 pass 0 fail /
  smoke baseline byte 同一 (AI 経路不変) / lint:* 8本 errors=0。opus 敵対設計レビュー 3 lens 済 (spec: `.claude/specs/bug-111-human-decline-fix-design.md`)。
- **重要判明**: **B05028 の chain over-fire は誤診断** (再現せず、5 シナリオ独立検証)。chain の continuation-drop が「そうした場合」gate として
  正しく動作 → **B05028 は engine 修正なしで出荷可能**。**B09038 は本修正で解禁** (sequence mandatory draw)。
- 水平展開: `sequence[0-pick, tail]` 該当 = 79 ability (MVP D11014 a2 含む、これも human-decline で draw が正しく発火するように)。
  choice/optional-tail の 6 出荷カード (B04080/B07079/B07055/B07031) は double-run 無し (probe 実証)。

## ★最優先: 解禁カード B05028 + B09038 の card-wave 出荷

certify DSL は `.tmp/certify/{B05028,B09038}.json` に在 (durable)。両者とも tier2 green。
1. card .ts を生成: certify spec → `verify-clone-identity.cjs` → `build-verified-codegen-input.cjs` → `taskA-codegen.cjs --write` → `taskA-register.cjs`。
   または小規模なので手書き (B05028=宣言a1 chain[charRemoveSetCard,sceneRemove]+宣言a2 charSetCard×2 / B09038=変装a1 handAddFromRemove + 登場a2 optional[chain[sleep, seq[sceneEnter,conditional charSetCard,draw]]] + 変装FILE7)。
   **B05028 は P 版 (B05028P) も clone**。B09038 は P 版有無を catalog で確認。
2. **gate5 必須** (`scripts/wf-gate5-batch4.mjs` 再利用 or 手書き、`model:'opus'`): 各 rep を実機検証 — **特に B09038 a2 を human-decline (sceneEnter 0登場) して draw が発火するか**を踏むこと (今回の修正点)。B05028 a1 は human-decline で step2 不発火 (chain gate) を確認。decoy + 負ケース。
3. 全gate (card-wave skill): validate-specs → tsc → vitest → smoke → baseline → playwright → gate5 実機 → pre-commit lint 8本。1 commit。

## 代替/後続タスク
- **トリアージ出荷バッチ#5**: window6+ 抽出 (`scripts/survey/sweep-window2.cjs <greenN>`、done 186 除外、green-only) → certify (`wf-certify.mjs`, opus, SUB5, 1本ずつ) → 出荷。fresh green pool ≈ 170 sig。
- **中型 engine クラスタ** (骨格凍結例外 + opus 敵対設計レビュー + 全gate): cutin-subtype filter (69枚) / grant-textual+set-card→host (60) / contact-removal-by-self (51) / dynamic-count (~45)。
- **choice-in-continuation surface gap** (B09056 解禁の前提): sequence remainder の choice/optional を eager-surface でなく正しく surface する engine 整備 (BUG-145 系)。要 opus 設計レビュー。

## プロセス必須
- certify/難判断/gate5-author agent は `model:'opus'`。engine 変更は骨格凍結例外 + opus 敵対設計レビュー + 全gate。
- 1 タスク = 1 独立コミット。docs commit は `.tmp/certify` durable を消さず `npm run docs`。push は branch→main ff-merge (分割実行)。
- ⚠ Workflow 並列は SUB=5 程度に throttle、1 workflow ずつ。
- smoke レポート (.claude/reports/smoke-*) は commit 対象外 (git add -A 後に `git reset .claude/reports/`)。
- Read hook がファイルを line1 で切る → Bash `cat -n` で読む / Edit 前に Read 1 回で登録 (memory project-claude-mem-read-hook-workaround)。

## 状態 doc
- BUG-111 修正: `.claude/bugs/BUG-111.md` (#2 節 = 修正済 + 誤診断訂正) / spec `.claude/specs/bug-111-human-decline-fix-design.md`
- defer: `.claude/specs/DEFERRED-INDEX.md` (batch#4 節に解決バナー、B05028/B09038 解禁・B09056 DEFER 継続)
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` / bug: .claude/bugs/index.base
- 詳細: memory.md セッション⑮ + sessions/2026-06-16.md
```

直近セッションは BUG-111 #2 (human-decline sequence mandatory-tail drop) を engine 根本修正 + opus 敵対レビュー + 全gate + CI green を完遂。
B05028 over-fire は誤診断と判明 (修正不要で出荷可能)、B09038 は修正で解禁、B09056 は choice-surface gap で DEFER 継続。
**次セッションは解禁 2 枚 (B05028/B09038) の card-wave 出荷が最優先。** `/clear` で新セッション推奨。
