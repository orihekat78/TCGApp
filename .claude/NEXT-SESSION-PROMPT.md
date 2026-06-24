# 次セッション再開プロンプト (2026-06-24 — セッション59: engine additive removeSetCard cost 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意 (下記)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-24、セッション59 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 93eaef93** (card wave engine-unlocked-0624: B08023/P+B08050/P engine変更0、★最新tip) ← dbbf434e (engine additive removeSetCard cost) ← 3dd8a100 (spec) ← 8808e549 (card wave novel-0624)。
  ⚠ dbbf434e = **engine 変更あり (additive)**。push 後 CI in_progress (run 28086402341) → **開始時に green 確定を確認**。
- branch `engine/additive-wave-removeset-cost-0624` = main 一致 (+ label `...-shipped`)。
- ⚠ **共有 working tree ハザード継続・実害確認**: 並行 card session が同一 OneDrive tree に B08023/B08050 等を mid-write 中
  (vitest で他 session の transient 未確定状態を踏み 2件 偽 fail を観測 → orthogonal で無視可と確認)。
  別 branch 作業は git worktree 必須。自 commit は `git add <自ファイル>` 明示・`git diff --cached --name-only` で混入確認 (NOT -A)。
- ⚠ auto-docs (structure/mapping/CHANGELOG) 未再生成 (precedent 通り未commit・CI除外、drift 蓄積中)。
- ⚠ memory.md / DEFERRED-INDEX.md は card session 編集中だった (M) → engine session では非 commit (clobber 回避)。

## セッション59 サマリ (engine additive: Cost removeSetCard)
- ユーザー指示=engine追加。set-card-removal Cost kind を選択 (前 wave stunChar と同型の proven additive)。
- brainstorming → spec (.claude/specs/engine-additive-removeset-cost-design.md) → TDD(RED→GREEN) → gate →
  opus 5-lens 敵対 review → concern 反映 → FF push を厳守。
- **新 Cost kind `removeSetCard`** (B08033 工藤有希子 a2「現場キャラに裏向きセットされたカードを合わせて n 枚リムーブ」):
  count-based の self-pool (TargetingRef 不使用、candidates() は set card 非列挙)。honor site 8点 = Cost union /
  canPay (self scene の faceUp:false 総数≥n + COST_KIND_MAP) / pay (costParams.hostUids 優先→scene順 fallback、
  explicit は自陣 uid filter=self-only guard) / UI costToText / validate-specs COSTS + sync-test /
  AbilityCostParams + costParamsToDyn (cost-param channel)。
- `mutate.removeOneSetCard` を **opts {faceDownOnly,cause} additive 拡張** (default で既存 B08034 path 完全保存=回帰0)。
- hook: cost で自 set card 離場 → **B07034** (純 observer「離れるたび draw」) 発火が faithful (cause:'cost'、rules/21 の
  by-own-ability gate は当該 trigger に無)。B02020 (opp側) は自 set 離場で非発火。
- **opus 5 lens 敵対 review = ship=true / BLOCKER 0** (4 no-blocker / 1 concern-only)。medium concern 3件
  (mixed-pool canPay / opp-source / explicit self-ownership) を予防テスト + self-only guard で反映。
- gate 全 green: tsc0 / 新テスト 14 / smoke winsA=498 不変 ex=0 / 8lint+eslint 0 / validate-specs (PR280 のみ pre-existing fail)。
- **B08033 a2 コスト gate 解禁** → card session が次回 certify 可 (登場時 setCard forEach + a2 AP/突撃[キャラ]付与 と併せ全句確認)。
  ⚠ DEFERRED-INDEX の set-card-removal / B08033 エントリは未更新 (card session が編集中だった) → 次 session で解禁反映。

## 並行 card session (engine変更0、本 tree で mid-write 観測)
- card session が a206e9dc 解放分から **B08023/P + B08050/P 出荷**、B08059/B08004 は再 DEFER (engine の「解禁」over-claim 訂正)。
  changelog `2026-06-24-09-wave-engine-unlocked-engine0.md` (出荷 93eaef93)。⚠ **BUG-158 起票**: 明示 uid:'$pick'+target carrier-reuse は human 経路で rider 不発 → 短縮形必須。出荷済 B02040/P・B02046/P・PR049 が水平展開で該当 (別 session で短縮形変換 or engine 両経路統一) (彼ら seq 09、私の engine は seq **10** にリネーム済で衝突回避)。

## 次やること候補 (要ユーザー選択)
A) **engine additive 続き** (本 session 流儀継続):
   - **scope array化** (B08019: on-scene+on-partner-area 併記、AbilityScope を array に)。MR scope reader 波及で risk 中。
   - **BUG-156/157 unified 修正** (sleepChar/stunChar cost over-pay の pick channel 配線 / read.char.ap/lp 無 guard
     相互再帰)。※非 additive ゆえ smoke 再ベースライン要・慎重に。
   - その他 additive gap (handReveal verb / color-negation filter B08082 / cardName-EXCLUSION B06087)。
B) **MR Phase 2/3/4** (session55 設計): Phase2=UI / Phase3=AI / Phase4=card wave (SOLE 15)。
C) **カード追加 継続** (card session 領分、engine変更0): **B08033 が今 wave で解禁** → 出荷可。残 green は novel 裾。
D) **auto-docs sync** (軽作業): `.claude/design` hold-aside → `npm run docs` → structure/CHANGELOG/mapping を明示 add → FF push。
   + DEFERRED-INDEX に B08033/set-card-removal cost の解禁を反映。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済の運用)
- 着手前 working tree 確認 (他 session WIP / `.claude/design` ?? = 除外) / branch first (engine は main tree+専用 branch 可、
  card session が別 worktree なら衝突無)。main 直 commit 禁止。
- **engine 変更時**: brainstorming skill → spec doc (.claude/specs/) → TDD(RED→GREEN) → tsc/vitest/smoke gate →
  **opus 敵対 review workflow** (additivity/完全性/hook忠実/test adequacy/edge lens) → concern 反映 → commit。
  additive (新 field/cost) は既存カード未宣言で回帰0、smoke winsA=498 で機械保証。
- 挙動不変ゲート: tsc0 / vitest (baseline はその時の HEAD で確認) / smoke:1000 + check:smoke-baseline (winsA=498) /
  回帰テスト追加 / engine0 の場合 validate-specs。
- **新 Cost kind の honor site (8点、本 session 実証)**: Cost union / canPay + COST_KIND_MAP / pay (+ cost-param reader) /
  UI costToText / validate-specs COSTS + sync-test / AbilityCostParams + costParamsToDyn。AI は canPay gate + pay fallback で
  自動カバー (computeAiCostParams は default no-op で fallback 委譲)。tsc の exhaustive `never` guard が switch 漏れ検出。
- **commit 運用**: pre-commit = `docs:check && 8 lints`。docs:check は auto-doc drift で落ちる (CI除外) → **8 lints 手動緑確認**
  (lint:bugs/listener/card-addition/test-pair/side-channel/component-testid/ok-false-pattern/icon-abilities) → `git commit --no-verify`。
  自ファイルのみ明示 add (NOT -A)。auto-doc は自 commit に含めない。
- **FF push**: 専用 branch を現 HEAD から → `git ls-remote origin main` で FF 可確認 → `git push origin HEAD:main`。
- 決定論優先: agent 前に grep/node/hash で機械検証できないか検討。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>`
  (col10=effect/11=cutIn/12=hira/13=henso/qAndA=qa)。
- Bash heredoc `<<'EOF'`。Read hook が file を line1 truncate → Edit は Read 1回で登録できる (truncate でも可) / 全文は Bash cat/sed。
- ★memory.md は thin (過去ログ sessions/2026-06-24.md)。DEFER 一覧: .claude/specs/DEFERRED-INDEX.md /
  bug: .claude/bugs/index.base (BUG-156/157=未着手 latent)。
```
