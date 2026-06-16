# 次セッション再開プロンプト (2026-06-16 トリアージ出荷バッチ#2 完了 — window4 確定green 4 + clone 4 = 8枚出荷)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-16、トリアージ出荷バッチ#2 完了)

正本 doc = `.claude/specs/triage-sweep-2026-06-15.md`。
- engine wave#2 cluster1〜14 + UI DM + 出荷バッチ#1 (確定green 56枚, ALL_CARDS 1211→1267) 出荷済。
- **出荷バッチ#2 = window4 確定green 4 distinct rep (B01052/B02025/B04022/B04031) + byte同一clone 4 = 8枚** 出荷 (ALL_CARDS 1267→1275、engine変更0)。
- gate5 実機検証 = 新規 `tests/cards/triage-greens-2026-06-16/` 4 files / 27 tests (decoy + 負ケース、BUG-117/118 per-card 閉)。
- 出荷除外: B08023 (REFUTED — choice 内 `uid:'$pick'+target` carrier が human 経路で continuation 喪失、short-form 書換で再挑戦余地) / D10003 (needsManual closure)。
- 重大教訓 (継続): certify grounding は `.tmp/taskA/certify-brief.md` (現行engine版)。決定論 green-candidate の **false-green 率 ≈ 55-65%** (必ず per-card certify)。

## ★最優先: 出荷バッチ#3 (段B) + スイープ継続

1. **window4 残8 reps を certify → 新green を出荷** (バッチ#3): 残8 = B08033 / B05027 / B01057 / B02031 / B03056 / B03079 / PR263 / PR099。
   - `.tmp/certify/` durable (無ければ wf-certify に id 配列を args 渡し、`model:'opus'`、SUB=5 throttle、1 workflow ずつ)。
   - green を `verify-clone-identity.cjs <rep...>` → `build-verified-codegen-input.cjs` → `taskA-codegen.cjs --write` → `taskA-register.cjs`。
   - **gate5 必須**: 各 distinct rep を `tests/cards/triage-greens-<date>/<rep>.test.ts` で実機挙動検証 (decoy + 負ケース、実 engine flow 駆動)。
2. **スイープ継続** (window5+、loop-until-dry): `node scripts/survey/sweep-window2.cjs <greenN>` (done除外・green層化) → wf-certify。
   新 yellow が暴く gate を `sweep-2026-06-15.ts` GATES に regex 還元 → 再実行。
3. **中型 engine クラスタ着手も選択肢**: cutin-subtype filter (69枚) / contact-removal-by-self (51) / grant-textual+set-card (60) 等。
4. **B08023 short-form 書換 再挑戦** も候補 (carrier を short-form `{player,max,side,filter,bind:'$picked'}` に直して再 certify→出荷)。

## プロセス必須
- certify/難判断 agent は `model:'opus'`。engine 変更は骨格凍結例外 + opus 敵対設計レビュー + 全gate。
- 出荷バッチは card-wave skill の全gate (validate-specs→tsc→vitest→smoke→smoke-baseline→playwright→gate5実機→pre-commit lint 9本)。
- 1 タスク = 1 独立コミット。docs commit は `.tmp/certify` durable を消さず `npm run docs`。push は main ff-merge (compound checkout&&merge&&push は分割実行)。
- ⚠ Workflow 並列は **SUB=5 程度に throttle**、**1 workflow ずつ** (25並列 + 別workflow 同時で server rate-limit 実害あり)。

## 状態 doc
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` / bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md
- 詳細: memory.md セッション⑫ + sessions/2026-06-15-5.md (⑩⑪)
```

直近セッションはトリアージ出荷バッチ#2 (window4 確定green 4 + clone 4 = 8枚 + gate5 27tests) を完遂。
**次セッションは出荷バッチ#3 (window4 残8 certify) + スイープ継続。** `/clear` で新セッション推奨。
