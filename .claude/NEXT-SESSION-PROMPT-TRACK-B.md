# 次セッション再開プロンプト — Track B: カード追加ツール (text→DSL compiler) (2026-07-02 新設)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効。Track A (engine 拡張) は [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) — 本 session は触らない領域に注意。

---

```text
名探偵コナンTCG MVP — Track B (カード追加ツール専任)。まず CLAUDE.md → CHANGELOG → memory.md を読む。

## ミッション
カードテキスト→DSL の **whitelist 文法 compiler** を構築し、残 540 枚を一括 author する。
silent 誤訳の源 = AI 即興翻訳を構造排除: 一致句のみ変換、**未知句 1 つでも card 全体 refuse → DEFER**。

## ★driver (必読)
- **[specs/compiler-track-plan-2026-07-02.md](specs/compiler-track-plan-2026-07-02.md)** — 設計/oracle/セッション分解 B0-B3/衝突回避。
- 全体計画 [specs/all-cards-completion-plan-2026-07-02.md](specs/all-cards-completion-plan-2026-07-02.md) /
  プロセス tier [specs/speed-rebalance-2026-07-02.md](specs/speed-rebalance-2026-07-02.md)。

## 現在地 (2026-07-02 B0 完了)
- ★開始時 `git ls-remote origin main` で remote HEAD 確認 (並行 Track A が進んでいる前提で origin/main 基準)。
- **B0 出荷済** (harness 全部決定論 script): `scripts/compiler/` = tsv-corpus / canonical / productions(空) /
  compile (未知句1つで card 全体 refuse) / dump-shipped / oracle (match/refuse/mismatch 3値 + --gate)。
  `tests/compiler/` 30 test が受入条件 (noCorpus=0 / mismatch=0 / match⊆vanilla) を回帰化。
- **実測 (棚卸訂正)**: universe 2049 / 実装済 **1509** (ALL_CARDS unique、closure 249) / 残 **540**。
  P printing は TSV 別行 (baseId fallback は保険)。vanilla 52。
- 再現手順: node scripts/compiler/tsv-corpus.cjs → npx tsx scripts/compiler/dump-shipped.ts →
  node scripts/compiler/oracle.cjs [--gate]。

## 次やること: B1 (文法 core、T2)
1. **句分割**: 【】〚〛アイコン / 「:」コスト境界 / 「。」節 / 接続 (「その場合」「代わりに」) を
   compile.cjs の segment() 差し替えで構造化。
2. **production rule 集**: productions.cjs に句形→DSL 断片 rule を登録 (rule 契約 = match/emit + 出典コメント、
   ファイル内に明文化済)。lexicon 種 = [specs/engine-extension-plan-2026-06-30.tsv](specs/engine-extension-plan-2026-06-30.tsv)
   の cardTextPattern/representativeQuote 列 + Track A wave 同梱 exemplar + 出荷済 1509 の頻出句から。
3. **裁定テーブル**: 「〜まで」=0可 rules/15 / colorNot some説 B08079 / exact-N / deck-look 型別 rules/26 を
   rule 内エンコード (出典明記)。
4. **等価形吸収**: canonical.cjs へ (sequence[1]=atom 等)。closure 249 枚の扱い (恒久 refuse か) を設計判断。
5. **G1 ゲート = 1509 oracle で silent mismatch 0** (mismatch は文法修正 or refuse 降格のみ)。
   文法 rule 集へ敵対 review 1 回 (2 lens、opus)。頻出句から着手し match% を毎 commit 計測。

## B2 以降 (driver 参照)
- B2: progressive bulk — **「1 wave 以上前に main 出荷済み primitive」の family のみ** compile 可 (Track A と衝突回避)。
  60-80 枚/commit。G1 実測が出るまで session 数は未確定。
- B3: refuse queue 手動 certify + Q&A 依存 except リスト化。

## ⚠ 衝突回避 (Track A と並行稼働)
- **`src/engine/**` は一切触らない** (骨格凍結。engine 不足発見 → DEFERRED-INDEX に記録し Track A へ送る)。
- 作業領域 = `scripts/compiler/**` + `tests/compiler/**` + (B2 以降) `src/cards/**` bulk。
- worktree 隔離: `git worktree add -b tool/compiler-<n> /c/tmp/<dir> origin/main` → node_modules は
  PowerShell `New-Item -ItemType Junction` で本 repo から張る (npm install 禁止) → 自ファイル明示 add +
  `--no-verify` commit → FF push (`git fetch` → `git rebase origin/main` → `git push origin HEAD:main`) → CI green 確認。
- worktree 撤去は node_modules junction hazard 手順 ([[feedback-worktree-remove-junction-hazard]])。

## プロセス共通
- tier: tool code=T1 (機械ゲートのみ) / 文法 rule 集=T2 (意味論、2 lens 1回) / emit カード=T1+family probe。
- 6ゲート: tsc0 / vitest baseline (origin/main HEAD 件数確認、B0 後 = 3552+1skip) / smoke:1000 winsA 不変 / 8lint。
- commit 後 CHANGELOG エントリ手書き + 本ファイル更新 (Track B の現在地のみ。Track A の NEXT-SESSION-PROMPT.md は触らない)。
- Read hook line1 truncate → 全文は Bash cat。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。
```
