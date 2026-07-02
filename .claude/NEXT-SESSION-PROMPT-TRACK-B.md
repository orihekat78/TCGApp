# 次セッション再開プロンプト — Track B: カード追加ツール (text→DSL compiler) (2026-07-02 新設)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効。Track A (engine 拡張) は [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) — 本 session は触らない領域に注意。

---

```text
名探偵コナンTCG MVP — Track B (カード追加ツール専任)。まず CLAUDE.md → CHANGELOG → memory.md を読む。

## ミッション
カードテキスト→DSL の **whitelist 文法 compiler** で残 540 枚を一括 author する。
silent 誤訳の源 = AI 即興翻訳を構造排除: 一致句のみ変換、**未知句 1 つでも card 全体 refuse → DEFER**。

## ★driver (必読)
- **[specs/compiler-track-plan-2026-07-02.md](specs/compiler-track-plan-2026-07-02.md)** — 設計/oracle/セッション分解 B0-B3/衝突回避。
- 全体計画 [specs/all-cards-completion-plan-2026-07-02.md](specs/all-cards-completion-plan-2026-07-02.md) /
  プロセス tier [specs/speed-rebalance-2026-07-02.md](specs/speed-rebalance-2026-07-02.md)。

## 現在地 (2026-07-02 B1 完了)
- ★開始時 `git ls-remote origin main` で remote HEAD 確認 (並行 Track A 前提、origin/main 基準 worktree)。
- **B0 出荷済** (harness): tsv-corpus / canonical / productions / compile / dump-shipped / oracle。
- **B1 出荷済** (文法 core): mine.cjs (desc突合+消去法+colspan+purge loop、全決定論) →
  rules/line-rules.json (**623 rules**、elim 起源は match 済 exemplar 必須 — 敵対 review BLOCKER 対応済) + rules/exceptions.json (9枚)。oracle 意味射影化
  (id/name/description/ruleRefs 除外)。**G1 達成: shipped 1509 で match 1161 (77%) / mismatch 0**
  (非closure天井 1260 の 92%)。vitest mined-rules.test.ts が G1 恒常 pin + mine.test.ts が purge 回帰 pin (計 3574 pass)。
- 再現手順: node scripts/compiler/tsv-corpus.cjs → npx tsx scripts/compiler/dump-shipped.ts →
  node scripts/compiler/mine.cjs (rules 再生成) → node scripts/compiler/oracle.cjs [--gate]。
- 副産物 (B3 queue): conflicts 6 key (shipped 同文言異DSL — 正誤裁定要)、shipped-gap-suspect 27 枚
  (部分実装疑い)、exceptions 9 枚。詳細 .tmp/compiler/mine-report.json (mine.cjs 再実行で再生成)。

## 次やること: B1.5 (parametric rule) → B2 (progressive bulk)
1. **parametric rule**: exact 行 rule の数値/色/特徴/カード名/レベル slot 化。
   採掘方針: 同一テンプレート (数値等を slot 抽象した key) に ≥2 exemplar があり DSL 側も対応 slot のみ
   異なる場合に限り parametric 化 (単独 exemplar は exact のまま)。地形実測: unshipped 540 の
   「未知行 1 本のみ」= 214 枚、line coverage 215/1155 → parametric の効きが良い。
2. **B2 emit 経路**: compile 出力 → CardDef codegen (taskA codegen 流儀、registry barrel 追記) +
   family probe test (origins=['elim']&count=1 の低保証 rule 経由カードは probe 優先度高 — 敵対 review 所見)。**「1 wave 以上前に main 出荷済み primitive」の family のみ** (Track A 衝突回避)。
   60-80 枚/commit。case カードの caseTraits は TSV 非収載 → 供給源設計が先。
3. B3: conflicts 6 の正誤裁定 / gap-suspect 27 の DEFERRED 照合 / exceptions 9 / closure 249 恒久 refuse 枠。

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
