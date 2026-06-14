# 次セッション再開プロンプト (2026-06-15 cluster6 + cluster7 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**
> 使う。難判断 agent (certify / 意味等価突合 / 敵対レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md「トークン運用ルール」。

> ⚠ **cluster6 + cluster7 の main 反映が未確認**: 2 commit (`227aaa68` cluster6 / `3f8f1a0e` cluster7) は
> branch `cards/wave2-cluster6` 上。ユーザー手動 or 前セッションで `git checkout main &&
> git merge --ff-only cards/wave2-cluster6 && git push origin main` 実行予定。新セッション開始時に
> `git log -1 origin/main` で乗ったか / CI green か確認すること (push 失敗時はスキップ可=ユーザー許可済)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15)

- engine拡張 wave#2 cluster1〜6 ✅ + cluster7 (engine変更0 card) ✅。ALL_CARDS = 1165。
- 直近2 commit (branch `cards/wave2-cluster6`、main 反映は要確認):
  - cluster6 `227aaa68`: usage-restriction (event-use ban) — B09034/B09034P + setEventUseBan verb +
    TurnScopedFlags.eventUseBanned + handAddFromRemove 複数pick path。
  - cluster7 `3f8f1a0e`: engine変更0 — B07067 沖矢昴 / B07070 新出智明 (handAtMost / handCountAtLeastOther 初消費)。
- 全 heavy gate green: full vitest 2105 / smoke:1000 baseline 完全一致 (no-op) / e2e playwright 119。

## 次にやること (候補、未確定 — ユーザーと相談 or triage から選定)

usage-restriction 族 (cluster5+6) と hand-count gate (cluster7) は刈り取り済。次クラスタは triage 6種の
viable 2種 (使用済) 以外 = 新規 engine ゲートになる。DEFERRED-INDEX の独立候補から選定:
- BUG-143 (contact-scope mod の turn-end 清掃 = rules/08 §6 違反、smoke baseline 変動注意) / BUG-144 (case action ガード窓)
- ヒラメキ抑止窓 (B06049、side-level action-scope flag) / action-restriction「〜できない」(B07005) /
  observer contact-removal attribution (D02008/B05066) / external hook firing (B08078、最難)
→ いずれも **新 engine 機構** のため card-wave skill の設計ゲート (Workflow grounding + 敵対設計レビュー、全 opus) を
  先に通すこと。または taskA-next-chunk.cjs の green候補 (reanimate 族 B06052/D05006/PR138 等) を engine変更0 で出荷。

## プロセス必須
- /card-wave skill を呼ぶ。green候補は未certify なら信用しない (TSV qAndA を web fetch 前に必ず見る)。
- 新挙動は専用 vitest で実証 (BUG-132 教訓)。PA 短縮形 (charModifyAP/sceneRemove) の test は runEffect →
  _drainAllEffectPicksForTest 必須 (cluster7 で踏んだ罠、resolve-picks.ts:438「PA は実行時解決」)。
- heavy gates (full vitest/smoke:1000/playwright) はフェーズ終端で1回。

## 状態 doc
- 設計記録: .claude/specs/engine-wave2-cluster5-usage-restriction-design.md (§cluster6)
- triage: .tmp/cluster4-triage.json / defer: .claude/specs/DEFERRED-INDEX.md / bug: .claude/bugs/index.base
```

cluster6 + cluster7 は完了 (branch 上に 2 commit、全 gate green)。次セッションは main 反映確認 → 次クラスタ選定から。
Continue from where you left off.
