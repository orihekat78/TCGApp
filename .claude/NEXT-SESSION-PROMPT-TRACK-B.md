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
  mine.cjs (desc突合+消去法+colspan+purge loop、全決定論) / demand-signal.cjs。rules/line-rules.json (**630 rules**) +
  exceptions.json (9枚)。**G1: shipped 1513 で match 1167 / mismatch 0**。vitest mined-rules.test.ts が G1 恒常 pin。
- **audit pivot 出荷済** (本 session): compiler の bulk 空振り実測 → 用途転換。conflict 6 key を裁定 →
  誤訳 2 件修正 ([[BUG-162]] PR276/D02004 「アクション終了時まで」scope + PR276 gated-chain、水平展開で D02004 発見)。
  conflict 6→5。demand-signal spec 出力。
- 再現手順: node scripts/compiler/tsv-corpus.cjs → npx tsx scripts/compiler/dump-shipped.ts →
  node scripts/compiler/mine.cjs → node scripts/compiler/oracle.cjs [--gate] →
  node scripts/compiler/demand-signal.cjs ({lines, subclauses} 2 粒度・ids 付き)。
- **B3-2 完了 (2026-07-02)**: gap-suspect 27 (base 20) を opus workflow で全数 certify → FULL 7 / DEFER 11 /
  真の欠落 2 = [[BUG-163]] B08079 変装 (修正済) + [[BUG-164]] B09100 deckLimit (engine → Track A 送り)。
  台帳補完 B03032/B04018、B05058 stale (grantTraits 出荷済=解禁候補)。gap-suspect 27→25 (残 25 は B09100 系 + P variant)。
- **B3-1/B3-3 完了 (2026-07-02)**: conflicts 5→**0** — shipped 再編集ゼロの**意味射影正規化 N1-N5** (canonical.cjs、
  engine 証明脚注付き + unit test 14) + C2 B03012 fidelity fix。G1 match 1167→**1244**・exceptions 9→**7**。
- **steady-state 初回転 (2026-07-02)**: Track A wave-10 exemplar **B07002/B07002P** を再採掘で G1 pin 化 —
  shipped 1515→**1517** / rules 630→**655** / match **1246** / mismatch 0 / conflicts 0 / exceptions 7 不変。
  compiler suite 68/68 green。demand-signal ランキング実質不変 (降格表と一致)。
  unlock 実測 = P printing 2 枚のみ → **B07031P/B08049P 出荷** (ALL_CARDS 1515)。exceptions 7 + align-ambiguous 2 は
  opus workflow 監査で**全 FULL_CORRECT (誤訳ゼロ・恒久 exception 枠)**。★教訓: 初版 ROI「10+5+4 枚 unlock」は
  行 unlock と card unlock の混同 — ヒラメキ 10 枚は各々別の新規複雑文を持つ。

## 次やること (B3 queue 完遂 → steady-state 運用)
1. ~~demand-signal を Track A へ~~ / ~~B3-2~~ / ~~B3-1 conflict canonical 化~~ / ~~B3-3 exceptions 監査~~ — **全完了 (2026-07-02)**。
2. **compiler は steady-state**: 新カード追加/変更時に tsv-corpus → dump-shipped → mine → oracle --gate を再実行し
   conflict/mismatch を surface (vitest mined-rules.test が G1 恒常 pin)。正規化 rule の追加は
   「engine 直読の証明脚注必須」原則を維持 (canonical.cjs 冒頭)。
3. 残り着手候補 (Track B 固有の queue は空):
   - gap-suspect 残 25 = B09100 系 (BUG-164 Track A 送り済) + P variant — 新規性なし、B09100 解決時に自然減。
   - card-phase 降格分 (MR PA 24 / set-event 15 / turn-grant 13 / B05058 grantTraits stale-defer 等) の刈り取りは
     **card-wave (Track A 側)** の管轄 — demand-signal spec (a) の降格表を参照。
   - 新セット (ct-p10 等) 投入時: corpus 再生成 → mine 再実行が最初の一手。

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
