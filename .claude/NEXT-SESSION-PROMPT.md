# 次セッション再開プロンプト (2026-06-24 — セッション58: engine additive wave 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意 (下記)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-24、セッション58 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = bad13ee4** (docs: DEFERRED-INDEX 解禁 + changelog-07) ← a206e9dc (engine additive wave) ← 813d0b19 (spec) ← d0bd58c6 (event-choose3 docs)。
  ⚠ a206e9dc は **engine 変更あり (additive)** — 本 wave で初めて骨格凍結の additive 例外を適用。⚠ push 時 CI in_progress → **開始時に green 確定を確認**。
- working tree clean (`.claude/design/` ?? のみ除外)。⚠ **auto-docs (structure/mapping/CHANGELOG) は未再生成** (precedent 通り未commit・CI除外。複数 wave 分 drift 蓄積中)。
- branch `engine/additive-wave-lvldelta-stuncost-0624` = main に一致。worktree `C:/tmp/conan-cards-w` (card session) も存在。
- ⚠ 共有 working tree ハザード継続: 別 branch 作業は git worktree 必須。`git add <file>` で明示、`git commit` 前に `git diff --cached --name-only` で混入確認。

## セッション58 サマリ (engine additive wave: lvlDelta + stunChar)
- ユーザー指示=engine拡張 (card は並行 session)。brainstorming→TDD→敵対 review→FF push を厳守。3-gap 束で着手。
- **Gap1 `ContinuousModifier.lvlDelta`**: apDelta/lpDelta 完全対称、honor site 2つ (read.char.level + candidates.matchOneFilter、BUG-117)。
  再帰は既存 `_inContinuousDelta` guard が depth-2 終端。B08059/B08050 解禁。test 9件 (read+filter sync / 条件 gate 両経路 / 負値 / closure)。
- **Gap3 Cost `stunChar`**: sleepChar 対称 + **n.max honor で「1枚」faithful**。honor site=union/canPay/pay/UI costToText/validate-specs。B08004 解禁。test 6件。
- **Gap2 carrier-reuse は stale DEFER 訂正 (engine変更0)**: bind:'$picked'+uid:'$picked.uid' は 2026-06-12 出荷済 (BUG-130)、exemplar B02040。**B08023 解放**。
- 各 gap **opus 4/3 lens 敵対 review = no-blocker**。surfacing した pre-existing 欠陥を **BUG-156** (sleepChar/stunChar over-pay) / **BUG-157** (read.char.ap/lp 無 guard 相互再帰) として記録。
- gate 全 green: tsc0 / eslint+8lint 0err / vitest **3054** (baseline d0bd58c6=~3039 + 新 15) / smoke **winsA=498** 不変。
- ⚠ **Workflow args 文字列暴走** (前 session 教訓、再掲): 配列 args は冒頭 `Array.isArray(args)?args:JSON.parse(args)` + 件数guard 必須 ([[feedback-workflow-args-string-blowout]])。本 session の review workflow は args 未使用で回避。

## 次にやること候補 (要ユーザー選択)
A) **engine additive 続き** (本 session の流儀継続): 残 DEFER の additive 解禁。
   - **scope array 化** (B08019: on-scene+on-partner-area 併記、AbilityScope を array に)。MR scope gate 直後で risk 中。
   - **set-card-removal COST kind** (B08033 a2 「セット裏向き2枚リムーブ」、DEFERRED-INDEX §286)。
   - **BUG-156/157 unified 修正** (cost over-pay の pick channel 配線 / read.char.*-recursion guard)。※非 additive ゆえ smoke 再ベースライン要・別途慎重に。
B) **MR Phase 2/3/4** (session55 設計から継続): Phase2=UI / Phase3=AI / Phase4=card wave (SOLE 15)。
C) **カード追加 継続** (card session 領分、engine変更0): 本 wave で **B08023/B08050/B08059/B08004 が解放済** → card-session が出荷可 (B08004 は errata 2026-03-02 現場条件追記を反映)。残 green候補は novel 裾、1枚ずつ certify。
D) **auto-docs sync** (軽作業): `.claude/design` hold-aside → `npm run docs` → structure/CHANGELOG/mapping を明示 add → commit → FF push ([[feedback-parallel-docs-contamination]])。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済の運用)
- 着手前 working tree 確認 (他 session WIP / `.claude/design` ?? = 除外) / branch first (engine は worktree でなく main tree+専用 branch でも可、card session が別 worktree なら衝突無し)。main 直 commit 禁止。
- **engine 変更時**: brainstorming skill → spec doc (.claude/specs/) → TDD (RED→GREEN) → tsc/vitest/smoke gate → **opus 敵対 review workflow** (additivity/完全性/再帰/test adequacy lens) → review concern 反映 → commit。additive (新 field/cost) は既存カード未宣言で回帰0、smoke winsA=498 で機械保証。
- 挙動不変ゲート: tsc0 (`npm run typecheck`) / vitest (**baseline 3054**、1skip) / smoke:1000 + check:smoke-baseline (winsA=498) / 回帰テスト追加 / engine0 の場合 validate-specs。
- **commit 運用**: pre-commit = `docs:check && 8 lints`。docs:check は auto-doc drift で落ちる (CI除外) → **8 lints 手動緑確認 (lint:bugs/listener/card-addition/test-pair/side-channel/component-testid/ok-false-pattern/icon-abilities) → `git commit --no-verify`**。自分のファイルのみ明示 add (NOT -A)。auto-doc は自 commit に含めない。
- **FF push**: 専用 branch を現 HEAD から → 明示 add → commit → `git push origin HEAD:main`。remote が並行 session で進んでいても現 HEAD がその上なら FF 成功。
- 新 Cost kind / ContinuousModifier field 追加時の honor site: Cost=union/canPay/pay/UI costToText/validate-specs COSTS + sync-test。continuous=read.char.* + candidates.matchOneFilter (BUG-117 で必ず両方)。tsc の exhaustive `never` guard が漏れを検出。
- 決定論優先: agent 前に grep/node/hash で機械検証できないか検討。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>` (col10=effect/11=cutIn/12=hira/13=henso/16=qa)。
- Bash heredoc `<<'EOF'`。Read hook が file を line1 truncate → Bash cat/sed で読む / Edit 前に Read 1回で登録。
- ★memory.md は thin (過去ログ sessions/2026-06-24.md)。DEFER 一覧: .claude/specs/DEFERRED-INDEX.md / bug: .claude/bugs/index.base (BUG-156/157=未着手 latent)。
```
