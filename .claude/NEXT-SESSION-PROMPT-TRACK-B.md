# 次セッション再開プロンプト — Track B: カード追加ツール (text→DSL compiler) (2026-07-02 新設)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効。Track A (engine 拡張) は [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) — 本 session は触らない領域に注意。

---

```text
名探偵コナンTCG MVP — Track B (カード追加ツール専任)。まず CLAUDE.md → CHANGELOG → memory.md を読む。

## ミッション
カードテキスト→DSL の **whitelist 文法 compiler** を構築し、残 535 枚を一括 author する。
silent 誤訳の源 = AI 即興翻訳を構造排除: 一致句のみ変換、**未知句 1 つでも card 全体 refuse → DEFER**。

## ★driver (必読)
- **[specs/compiler-track-plan-2026-07-02.md](specs/compiler-track-plan-2026-07-02.md)** — 設計/oracle/セッション分解 B0-B3/衝突回避。
- 全体計画 [specs/all-cards-completion-plan-2026-07-02.md](specs/all-cards-completion-plan-2026-07-02.md) /
  プロセス tier [specs/speed-rebalance-2026-07-02.md](specs/speed-rebalance-2026-07-02.md)。

## 現在地
- ★開始時 `git ls-remote origin main` で remote HEAD 確認 (並行 Track A が進んでいる前提で origin/main 基準)。
- B0 未着手。universe 2049 / 実装済 1514 / 残 535 (2026-07-02 実測)。

## 次やること: B0 (harness、全部決定論 script、T1)
1. **corpus 抽出**: `.claude/specs/cards-data/**/*.tsv` → 全カード印字全列の正規化 JSON
   (col10 effect + **col11/12/13 cutin/hirameki/henso 必須** [[feedback-card-grounding-all-printed-columns]])。
   出力 `.tmp/compiler/corpus.json`。既存 helper `.tmp/_fulltext.cjs` / `.tmp/_label_to_ids.json` 参考。
2. **shipped DSL loader**: origin/main の CardDef 1514 件 → canonical JSON (正規化: key 順/等価形)。
   `scripts/taskA-validate-specs.cjs` の読込流儀を再利用。
3. **oracle diff runner**: compile 出力 ⇔ shipped DSL の 3 値判定 (match/refuse/mismatch) + レポート。
4. B0 完了時点で「素通し (production 0 件) の refuse 率 100%」が正常動作確認になる。
- lexicon 種: [specs/engine-extension-plan-2026-06-30.tsv](specs/engine-extension-plan-2026-06-30.tsv) の
  cardTextPattern/representativeQuote 列 + Track A が wave 毎に同梱する exemplar カード。

## B1 以降 (driver 参照)
- B1: 句分割 (【】〚〛/「:」コスト境界/「。」節) + production rule 集 + 裁定テーブル
  (「〜まで」=0可 rules/15 / colorNot some説 B08079 / exact-N / deck-look 型別 rules/26)。
  **G1 ゲート = 1514 oracle で silent mismatch 0** (mismatch は文法修正 or refuse 降格のみ)。文法集へ敵対 review 1 回 (2 lens)。
- B2: progressive bulk — **「1 wave 以上前に main 出荷済み primitive」の family のみ** compile 可 (Track A と衝突回避)。
  60-80 枚/commit。G1 実測が出るまで session 数は未確定。
- B3: refuse queue 手動 certify + Q&A 依存 except リスト化。

## ⚠ 衝突回避 (Track A と並行稼働)
- **`src/engine/**` は一切触らない** (骨格凍結。engine 不足発見 → DEFERRED-INDEX に記録し Track A へ送る)。
- 作業領域 = `scripts/compiler/**` + `tests/compiler/**` + (B2 以降) `src/cards/**` bulk。
- worktree 隔離: `git worktree add -b tool/compiler-<n> /c/tmp/<dir> origin/main` → 自ファイル明示 add +
  `--no-verify` commit → FF push (`git fetch` → `git rebase origin/main` → `git push origin HEAD:main`) → CI green 確認。
- worktree 撤去は node_modules junction hazard 手順 ([[feedback-worktree-remove-junction-hazard]])。

## プロセス共通
- tier: tool code=T1 (機械ゲートのみ) / 文法 rule 集=T2 (意味論、2 lens 1回) / emit カード=T1+family probe。
- 6ゲート: tsc0 / vitest baseline (origin/main HEAD 件数確認) / smoke:1000 winsA 不変 / 8lint。決定論スクリプト優先。
- commit 後 CHANGELOG エントリ手書き + 本ファイル更新 (Track B の現在地のみ。Track A の NEXT-SESSION-PROMPT.md は触らない)。
- Read hook line1 truncate → 全文は Bash cat。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。
```
