# 次セッション再開プロンプト (2026-06-15 トリアージ出荷バッチ#1 完了 — 確定green 56枚出荷)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15、トリアージ出荷バッチ#1 完了)

正本 doc = `.claude/specs/triage-sweep-2026-06-15.md`。
- engine wave#2 cluster1〜14 + UI DM 出荷済。**トリアージ出荷バッチ#1 = 確定 green 56枚 (25 distinct rep + byte同一clone 31) 出荷** (ALL_CARDS 1211→1267)。
- 出荷パイプライン: certify済 spec (.tmp/certify/<rep>.json) → `verify-clone-identity.cjs` (clone byte同一性) → `build-verified-codegen-input.cjs` → `taskA-codegen.cjs --write` → `taskA-register.cjs`。
- **gate5 実機検証を新規 `tests/cards/triage-greens-2026-06-15/` 25 files/172 tests で per-card 担保** (decoy + 負ケース、BUG-117/118 閉)。
- B07098/P を DEFER 解除 (forEach-over-remove で count-dyn 回避)。`build-verified-codegen-input.cjs` に DEFER 照合ガード追加。
- 重大教訓 (継続): certify grounding は `.tmp/taskA/certify-brief.md` (現行engine版、cap-map 2026-06-06 は stale)。決定論 green-candidate の **false-green 率 ≈ 55-65%** (必ず per-card certify)。

## ★最優先: 出荷バッチ#2 + スイープ継続

1. **window4 の確定 green を出荷** (バッチ#2): window4 certify済の green 4枚 (B01052/B04022/B02025/B04031、全 verify.ok) +
   window4 残8 reps を再 certify (`.tmp/certify/` durable、無ければ wf-certify に id 配列) → clone検証 → codegen → 全gate。
   - 抽出: `node scripts/survey/sweep-window2.cjs <greenN>` (done除外・green層化) → wf-certify。
   - clone: `node scripts/survey/verify-clone-identity.cjs <rep...>` → `build-verified-codegen-input.cjs` → codegen。
   - **gate5 必須**: 各 distinct rep を `tests/cards/triage-greens-<date>/<rep>.test.ts` で実機挙動検証 (decoy + 負ケース)。
   - ⚠ Workflow 並列は **SUB=5 程度に throttle** (25並列 + 別workflow 同時で server rate-limit 実害あり)。1 workflow ずつ。
2. **スイープ継続** (window5+、loop-until-dry): 新 yellow が暴く gate を `sweep-2026-06-15.ts` GATES に regex 還元 → 再実行。
3. **中型 engine クラスタ着手も選択肢**: cutin-subtype filter (69枚) / contact-removal-by-self (51) / grant-textual+set-card (60) 等。

## プロセス必須
- certify/難判断 agent は `model:'opus'`。engine 変更は骨格凍結例外 + opus 敵対設計レビュー + 全gate。
- 出荷バッチは card-wave skill の全gate (validate-specs→tsc→vitest→smoke→playwright→gate5実機→pre-commit lint 9本)。
- 1 タスク = 1 独立コミット。docs commit は `.tmp/certify` durable を消さず `npm run docs`。push は main ff-merge (compound checkout&&merge&&push は分割実行)。

## 状態 doc
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` / bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md
- 詳細: memory.md セッション⑪ + sessions/2026-06-15-*.md
```

直近セッションはトリアージ出荷バッチ#1 (確定green 56枚 + gate5 172tests) を完遂。
**次セッションは出荷バッチ#2 (window4 green) + スイープ継続。** `/clear` で新セッション推奨。
