# 次セッション再開プロンプト (2026-06-15 トリアージ・スイープ 進行中 — window3 まで完了見込み)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15、トリアージ・スイープ multi-window 進行中)

正本 doc = `.claude/specs/triage-sweep-2026-06-15.md` (全 universe スイープ + ロードマップ)。
- engine wave#2 cluster1〜14 + UI DM 出荷済 (ALL_CARDS 1211)。未実装 838 cards / 485 distinct signature。
- スイープ = 全未実装カードを gate 別分類し「あと N クラスタ」確定。決定論 sweep + per-card certify (loop-until-dry)。
- **重大教訓**: certify grounding の capability-map.txt が 2026-06-06 stale → certify-brief.md を現行化済 (.tmp、都度再生成)。
  決定論 green-candidate の **false-green 率 ≈ 65%** (信用不可、必ず certify)。
- 決定論 landscape (NEW gate 還元後): 🟢 green-candidate 249sig/398cards / 🟡 yellow 221/413 / ⚫ black 15/27。
- certify 済 (windows 1〜3): 確定 green は doc + `.tmp/certify/*.json` 参照。NEW gate ~19 発見→ sweep regex 還元済。

## ★最優先: スイープ継続 (green bucket 収束 → N 確定 → 出荷開始)

1. **window 4+ で green bucket をさらにサンプル** (false-green 率が収束するまで loop-until-dry)。
   - 抽出: `node scripts/survey/sweep-window2.cjs <greenN>` (done除外・green層化) → id配列を wf-certify に渡す。
   - certify は 1rep≈200k tok・1窓~25-30rep・SUB=8 で throttle 回避。`.tmp/certify/` durable。
   - 新 yellow が暴く gate を `scripts/survey/sweep-2026-06-15.ts` の GATES に regex 還元 → `npx tsx ...sweep-2026-06-15.ts` 再実行。
2. **確定 green を card-wave バッチで出荷開始** (card-wave skill / taskA: certify済 spec → codegen → 全gate)。
3. **ロードマップ確定** = doc の「ロードマップ」節を N 確定値で更新。

## ロードマップ暫定 (doc 参照)
- green-now ≈ 398cards の ~35% (要 per-card certify)。
- 高yield中型クラスタ (共有プリミティブ先行): cutin-subtype filter(69) / contact-removal-by-self trigger(51) /
  grant-textual+set-card-ability(60) / dynamic-count family(~45) / scene→deck+FILE残 / stacked-identity / remove→deck-selective。
- 構造XL ×3 (最終段): partner-area(27) / name-designation(15) / loseGame-rewrite(17)。
- 長尾 ~20 niche gate = 大半 defer。

## プロセス必須
- certify/難判断 agent は `model:'opus'`。engine 変更は骨格凍結例外 + opus 敵対設計レビュー + 全gate。
- 1 タスク = 1 独立コミット。docs commit は `.tmp` を消さず (`.tmp/certify` durable) `npm run docs`。
- push は main ff-merge (compound checkout&&merge&&push は分割実行)。

## 状態 doc
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` / 旧 gate ranking: engine-gate-triage-2026-06-15.md
- bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md / 詳細: memory.md セッション⑩ + sessions/2026-06-15-4.md
```

直近セッションはトリアージ・スイープ window 1〜3 を実施 (決定論 landscape + 56→88 rep certify + NEW gate ~19 発見)。
**次セッションはスイープ継続 (green bucket 収束 → N 確定 → 出荷開始)。** `/clear` で新セッション推奨。
