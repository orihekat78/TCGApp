# 次セッション再開プロンプト (2026-06-16 トリアージ出荷バッチ#4 完了 — window5 出荷 10+clone 10=20枚、gate5 が B05028 BUG-111 を捕捉)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-16、トリアージ出荷バッチ#4 完了、HEAD≈92660971 + docs commit)

正本 doc = `.claude/specs/triage-sweep-2026-06-15.md`。
- engine wave#2 cluster1〜14 + UI DM + 出荷バッチ#1 (56) + #2 (8) + #3 (2) + **#4 (20)** 出荷済。
- **バッチ#4 = window5 fresh green候補 20 を certify → green 13 / verified 11 → gate5 実機で B05028 の BUG-111 を捕捉 →
  出荷 verified-green 10 + byte同一 clone 10 = 20枚** (ALL_CARDS 1277→1297、engine変更0)。CI green。
  出荷: B01065/B02038/B03031/B05024/B07041/B01076/B02041/B04051/B07057/PR237 (+各clone)。
- certify cache = **140 done** (120 + window5 20)。fresh green pool ≈ 170 (236 greenCandidate − done)。
- **重大教訓 (今回の核心)**: 決定論 green候補 20 → 出荷 10 (実効 ~50%)。**certify + 敵対verify だけでは
  BUG-111 系 (candidate在 + human-decline で chain-gated「そうした場合」continuation が drop/誤発火) を見落とす**。
  AI は greedy で decline せず仮面化 → smoke/certify をすり抜け、**gate5 実機 decoy (human-decline 路) のみが検出**。
  → gate5 で「0-pick 後に chain/必須末尾を持つ型」は必ず human-decline 路を踏むこと。
- **DEFER (DEFERRED-INDEX batch#4 節)**: refuted B09038(再×2)/B09056 + gate5-defer B05028 = 全て **BUG-111**
  (BUG-111.md に「関連未解決: human-decline 経路」節を追記、修正方針案あり)。yellow 7 = B04042(sum制約)/B06032(hirameki
  top-optional skip)/B08038(removed-by-this-effect)/PR236(distinct-name count)/B03033(相手side aura)/B06033(hand→evidence)/B08050(継続self level)。
- gate5: `tests/cards/triage-greens-2026-06-16/` に 10 新規 (計142 tests green、`scripts/wf-gate5-batch4.mjs` で opus 11並列 author)。

## ★最優先: window6+ 抽出 → certify → 出荷バッチ#5 (loop-until-dry)

1. **新 window 抽出**: `node scripts/survey/sweep-window2.cjs <greenN>` (done 140 除外・green層化) → 出力 id 配列。
   または batch#4 と同じ green-only 抽出 (gate サンプル省略で ship yield 最大化、cost 上限 ~20rep/窓)。
   DEFERRED-INDEX 既載を除外。`.tmp/sweep/window6-greens.json` 等に保存。
2. **certify**: `.tmp/certify/` は durable。新 id 配列を `Workflow({scriptPath:'.../scripts/wf-certify.mjs', args:[...ids]})` で
   実行 (`model:'opus'` 固定、SUB=5、**1 workflow ずつ**)。1rep≈200k tok・窓毎~20rep が上限。
3. **verified-green を出荷**: certify spec → `verify-clone-identity.cjs <rep...>` > `.tmp/clone-verify.json` →
   `build-verified-codegen-input.cjs` → `taskA-codegen.cjs <input> --write` → `taskA-register.cjs "<label>"`。
   **gate5 必須** (`scripts/wf-gate5-batch4.mjs` を再利用、args は `[{rep,pkg},...]`): 各 distinct rep を実機検証
   (decoy + 負ケース + **0-pick 型は human-decline 路**)。vitest 実走 → 失敗/concern を triage (concern=実バグ疑い→当該カード DEFER)。
4. **codegen の罠 (batch#4 教訓)**: case:to-resolved 等は codegen が closure matcher を文字列出力 → validate-specs で検出。
   共有 factory (`caseResolvedHandRemove` 等) へ手動差替えで解消。build-verified-codegen-input は既実装を除外するので
   出荷後の再生成は 0 files になる (修正は .ts 直編集)。

## 代替タスク (選択肢)
- **中型 engine クラスタ着手** (骨格凍結例外 + opus 敵対設計レビュー + 全gate): cutin-subtype filter (69枚) /
  grant-textual+set-card→host (60) / contact-removal-by-self (51) / dynamic-count family (~45)。
  **+ BUG-111 修正** (human-decline で chain-gate/必須末尾を正しく扱う) で B05028/B09056/B09038 系の chain-decline カードを解禁。

## プロセス必須
- certify/難判断/gate5-author agent は `model:'opus'`。engine 変更は骨格凍結例外 + opus 敵対設計レビュー + 全gate。
- 出荷バッチは card-wave skill の全gate (validate-specs→tsc→vitest→smoke→baseline→playwright→gate5実機→pre-commit lint 9本)。
- 1 タスク = 1 独立コミット。docs commit は `.tmp/certify` durable を消さず `npm run docs`。push は **branch→main ff-merge** (compound checkout&&merge&&push は分割実行)。
- ⚠ Workflow 並列は **SUB=5 程度に throttle**、**1 workflow ずつ** (高並列 + 別workflow 同時で server rate-limit 実害あり)。
- smoke レポート (.claude/reports/smoke-*) は commit 対象外 (git add -A 後に `git reset .claude/reports/`)。

## 状態 doc
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` / bug: .claude/bugs/index.base (BUG-111 = chain-decline gate) / defer: .claude/specs/DEFERRED-INDEX.md
- 詳細: memory.md セッション⑭ + sessions/2026-06-16.md (⑫⑬)
```

直近セッションはトリアージ出荷バッチ#4 (window5 certify → 出荷 10+clone 10=20枚、gate5 が B05028 BUG-111 を捕捉して DEFER) を完遂。
**次セッションは window6+ 新規抽出 → certify → バッチ#5、or 中型 engine クラスタ着手 (+BUG-111 修正で chain-decline 系解禁)。** `/clear` で新セッション推奨。
