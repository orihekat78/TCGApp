# 次セッション再開プロンプト — Track B: カード追加ツール (text→DSL compiler) (2026-07-02 新設)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効。Track A (engine 拡張) は [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) — 本 session は触らない領域に注意。

---

```text
名探偵コナンTCG MVP — Track B (カード追加ツール専任)。まず CLAUDE.md → CHANGELOG → memory.md を読む。

## ミッション (2026-07-02 pivot: bulk author → 監査 + demand-signal)
compiler の bulk author は **実測空振り** (B1.5 parametric +0枚 / B2 whole-line 1枚 / 節分割上限 9枚 —
残 539 枚は新規複雑文、whole-line 文法は飽和)。ユーザー承認で用途を転換:
① **回帰ゲート** = G1 (mismatch=0) oracle + conflict 検出で shipped 1510 枚の DSL 誤訳を surface。
② **Track A demand-signal** = 未被覆節を影響カード数でランクし engine 拡張優先度を供給。
③ **B3 監査** = conflict / gap-suspect / exceptions の per-card 裁定。
silent 誤訳排除の原則 (一致句のみ変換・未知句 1 つで refuse) は oracle 側で維持。詳細=
**[specs/compiler-demand-signal-2026-07-02.md](specs/compiler-demand-signal-2026-07-02.md)**。

## ★driver (必読)
- **[specs/compiler-track-plan-2026-07-02.md](specs/compiler-track-plan-2026-07-02.md)** — 設計/oracle/セッション分解 B0-B3/衝突回避。
- 全体計画 [specs/all-cards-completion-plan-2026-07-02.md](specs/all-cards-completion-plan-2026-07-02.md) /
  プロセス tier [specs/speed-rebalance-2026-07-02.md](specs/speed-rebalance-2026-07-02.md)。

## 現在地 (2026-07-02 pivot 完了)
- ★開始時 `git ls-remote origin main` で remote HEAD 確認 (並行 Track A 前提、origin/main 基準 worktree)。
- **B0/B1 出荷済** (harness + 文法 core): tsv-corpus / canonical / productions / compile / dump-shipped / oracle /
  mine.cjs (desc突合+消去法+colspan+purge loop、全決定論)。rules/line-rules.json (**626 rules**) + exceptions.json (9枚)。
  **G1: shipped 1510 で match 1162 / mismatch 0**。vitest mined-rules.test.ts が G1 恒常 pin + mine.test.ts が purge 回帰 pin。
- **audit pivot 出荷済** (本 session): compiler の bulk 空振り実測 → 用途転換。conflict 6 key を裁定 →
  誤訳 2 件修正 ([[BUG-162]] PR276/D02004 「アクション終了時まで」scope + PR276 gated-chain、水平展開で D02004 発見)。
  conflict 6→5。demand-signal spec 出力。
- 再現手順: node scripts/compiler/tsv-corpus.cjs → npx tsx scripts/compiler/dump-shipped.ts →
  node scripts/compiler/mine.cjs → node scripts/compiler/oracle.cjs [--gate]。demand-signal: node scripts/... (下記 spec)。
- B3 queue (未着手): conflicts 5 (benign encoding drift、canonical 化で conflict-blocked 行 unlock 可)、
  shipped-gap-suspect 27 (部分実装疑い、要 certify)、exceptions 9 (composition 不能)、align-ambiguous 2。詳細 .tmp/compiler/mine-report.json。

## 次やること (優先度順、bulk author は行わない)
1. **demand-signal を Track A へ**: [specs/compiler-demand-signal-2026-07-02.md](specs/compiler-demand-signal-2026-07-02.md)
   の需要ランクを engine-extension-plan に反映 (or Track A session に直接手渡し)。着手前 origin/main 直読で stale 再採寸。
2. **B3-2 shipped-gap-suspect 27 の certify**: 印字全列 ⇔ DSL で per-card 裁定 → 真の部分実装は BUG-XXX + 修正。
3. **B3-1 conflict canonical 化 (要 tier 判断)**: benign 5 key を 1 encoding に統一すれば conflict-blocked 行が unlock。
   多数 shipped card 再編集ゆえ ROI と risk を見てから。
4. **B3-3 exceptions 9 + align-ambiguous 2 の調査**、closure 249 は恒久 refuse 枠として据え置き。
- ※ compiler は今後「回帰ゲート + 監査」として使う。新カード大量投入時は mine 再実行で conflict/mismatch を CI surface。

## ⚠ 衝突回避 (Track A と並行稼働)
- **`src/engine/**` は一切触らない** (骨格凍結。engine 不足発見 → DEFERRED-INDEX に記録し Track A へ送る)。
- 作業領域 = `scripts/compiler/**` + `tests/compiler/**` + (B2 以降) `src/cards/**` bulk。
- Track A がカード追加後に mined-rules.test の G1 pin が fail した場合 = 新カードが既存 rule と同文言・
  異DSL (意図的アラーム)。対処: mine.cjs 再採掘 (conflict なら自動 refuse 降格) or 実装側を exemplar に揃える。
- worktree 隔離: `git worktree add -b tool/compiler-<n> /c/tmp/<dir> origin/main` → node_modules は
  PowerShell `New-Item -ItemType Junction` で本 repo から張る (npm install 禁止) → 自ファイル明示 add +
  `--no-verify` commit → FF push (`git fetch` → `git rebase origin/main` → `git push origin HEAD:main`) → CI green 確認。
- worktree 撤去は node_modules junction hazard 手順 ([[feedback-worktree-remove-junction-hazard]])。

## プロセス共通
- tier: tool code=T1 (機械ゲートのみ) / 文法 rule 集=T2 (意味論、2 lens 1回) / emit カード=T1+family probe。
- 6ゲート: tsc0 / vitest baseline (B1 後 = 3574+1skip) / smoke:1000 winsA=498 不変 / 8lint (eslint は
  worktree で config 未解決 — CI 側で確認)。決定論スクリプト優先。
- commit 後 CHANGELOG エントリ手書き + 本ファイル更新 (Track B の現在地のみ)。
- Read hook line1 truncate → 全文は Bash cat。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。
```
