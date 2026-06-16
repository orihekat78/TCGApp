# 次セッション再開プロンプト (2026-06-16 トリアージ出荷バッチ#3 完了 — window4 完全消化、verified green B03079 + clone = 2枚出荷)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-16、トリアージ出荷バッチ#3 完了、HEAD=ca0aed87)

正本 doc = `.claude/specs/triage-sweep-2026-06-15.md`。
- engine wave#2 cluster1〜14 + UI DM + 出荷バッチ#1 (green 56枚) + #2 (window4 green 4+clone 4=8枚) 出荷済。
- **出荷バッチ#3 = window4 残8 certify → verified green B03079 + clone B03079P = 2枚** 出荷 (ALL_CARDS 1275→1277、engine変更0)。
  CI green (run 27587734375, 3m7s)。
- **window4 (=window2-ids.json, 32 rep) は完全消化**: 32 certified / green 6 / verified-green 5 (batch#2 4 + batch#3 1) /
  refuted 1 (B03056) / yellow 26。**残 certify 0** → 次は window5+ を新規抽出。
- gate5: 新規 `tests/cards/triage-greens-2026-06-16/B03079.test.ts` 7 tests (a1 を removeToRemove 相手ターンで実発火し
  color:'赤' filter を decoy で実評価実証 + 負ケース、a2 hirameki トリガー実発火 + D05007 構造等価)。
- **新規 gate 発見 (B03056 REFUTE 由来)**: `conditional-gated-optional surfacing` — `conditional{if, then: optional}` で
  engine が if 評価前に optional を eager surface し resume 時に conditional を落とす (DEFERRED-INDEX 記録済)。
- yellow 6 DEFER: B08033(set-card-cost) / B05027(MR partner-area) / B01057・B02031(set-card→host) / PR263(partner-area) /
  PR099(name-designation) — すべて既知 STILL-OPEN gate。
- 重大教訓 (継続): certify grounding = `.tmp/taskA/certify-brief.md` (現行engine版)。決定論 green-candidate の
  **false-green 率 ≈ 55-65%** (必ず per-card certify)。`scripts/wf-certify.mjs` の SUB は 8→5 に恒久変更済。

## ★最優先: window5+ 新規抽出 → certify → 出荷バッチ#4 (loop-until-dry)

1. **新 window 抽出**: `node scripts/survey/sweep-window2.cjs <greenN>` (done除外・green層化、window4 は done 扱い)。
   出力 id 配列を確認 → DEFERRED-INDEX に既載のものを除外。
2. **certify**: `.tmp/certify/` は durable。新 id 配列を `Workflow({scriptPath:'.../scripts/wf-certify.mjs', args:[...ids]})` で
   実行 (`model:'opus'` 固定済、SUB=5 throttle、**1 workflow ずつ**)。1rep≈200k tok・窓毎~20rep が上限。
3. **verified-green を出荷**: `verify-clone-identity.cjs <rep...>` > `.tmp/clone-verify.json` →
   `build-verified-codegen-input.cjs` → `taskA-codegen.cjs <input> --write` → `taskA-register.cjs "<label>"`。
   **gate5 必須**: 各 distinct rep を `tests/cards/triage-greens-<date>/<rep>.test.ts` で実機挙動検証 (decoy + 負ケース、実 engine flow 駆動)。
4. **loop-until-dry**: 新 yellow が暴く gate を `sweep-2026-06-15.ts` GATES に regex 還元 → 再実行で landscape 更新。
   `conditional-gated-optional` は構造 gate (text regex 困難) のため certify 段で個別検出。

## 代替タスク (選択肢)
- **中型 engine クラスタ着手**: cutin-subtype filter (69枚) / contact-removal-by-self (51) / grant-textual+set-card (60) /
  dynamic-count family (~45)。骨格凍結例外として opus 敵対設計レビュー + 全gate。
- **B08023 short-form 書換 再挑戦** (batch#2 REFUTE分): carrier を short-form `{player,max,side,filter,bind:'$picked'}` に
  直して再 certify→出荷。

## プロセス必須
- certify/難判断 agent は `model:'opus'`。engine 変更は骨格凍結例外 + opus 敵対設計レビュー + 全gate。
- 出荷バッチは card-wave skill の全gate (validate-specs→tsc→vitest→smoke→smoke-baseline→playwright→gate5実機→pre-commit lint 9本)。
- 1 タスク = 1 独立コミット。docs commit は `.tmp/certify` durable を消さず `npm run docs`。push は main ff-merge (compound checkout&&merge&&push は分割実行)。
- ⚠ Workflow 並列は **SUB=5 程度に throttle**、**1 workflow ずつ** (高並列 + 別workflow 同時で server rate-limit 実害あり)。
- smoke レポート (.claude/reports/smoke-*) は commit 対象外 (慣例、git add -A 後に `git reset .claude/reports/`)。

## 状態 doc
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` / bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md
- 詳細: memory.md セッション⑬ + sessions/ (過去ローテート分)
```

直近セッションはトリアージ出荷バッチ#3 (window4 残8 certify → verified green B03079 + clone = 2枚 + gate5 7tests) を完遂。
**次セッションは window5+ 新規抽出 → certify → バッチ#4、or 中型 engine クラスタ着手。** `/clear` で新セッション推奨。
