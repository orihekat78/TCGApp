# 次セッション再開プロンプト (2026-06-24 — セッション57: BUG-155 完全横展開 sweep 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意 (下記)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-24、セッション57 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 8c3001a2** (event-choose3 docs) ← 5c275922 (chore + B08075 cards 混入) ← 542feac5 (BUG-155 sweep) ← 877ad627 (newbase)。
  全て engine変更0 (`git diff 877ad627..HEAD -- src/engine` 空)。⚠ 5c275922/8c3001a2 の CI は push 時点 in_progress → **開始時に green 確定を確認**。
- **B08075/B08075P ブライダルは女が主役** (event-choose3 wave、engine変更0) は shared-index 経由で **5c275922 に意図せず混入出荷済**。docs(changelog-06 + DEFER 6rep) は 8c3001a2。working tree clean (`.claude/design/` ?? のみ除外)。
- branch `cards/bug155-pick-filter-kind` = main に一致。worktree `C:/tmp/conan-cards-w` (branch cards/engine0-wave-0624 @877ad627) も存在。
- ⚠ 共有 working tree ハザード継続: 別 session の commit/branch切替が共有 HEAD/index を動かす (今回 docs commit が並行 WIP を巻込)。別 branch 作業は git worktree 必須。`git add <file>` で明示、`git commit` 前に `git diff --cached --name-only` で混入確認。

## セッション57 サマリ (BUG-155 完全横展開 sweep)
- ユーザー選択 B。ALL_CARDS の全 pick filter を決定論 walk → mixed-area (手札/リムーブ/デッキ) で trait/color/keyword
  絞り込み∧kind欠落 = 50カード/59 filter。公式テキスト直読で分類 → **fix-character 19 / fix-event 1 (B07062) /
  カード非限定で正 9 / cardName限定 21**。20ファイル/22edit (engine変更0、PR241 spread連動)。
- **live bug 発見・修正**: B05112「【カットイン】を持つ【黒】の**キャラ**を登場」が kind 欠落で カットイン**イベント**
  B04096 を sceneEnter (登場=キャラ専用) で候補化し得た。対照 B06100=「カード」非限定が正 (同 filter 形が キャラ/カードで正否反転)。
- 回帰テスト `tests/cards/bug155-pick-filter-kind-2026-06-24.test.ts` 25件 (behavioral matchOneFilter除外 + structural)。
- gate 全 green: tsc0 / eslint0 / vitest **3037** (既存3012不変) / smoke **winsA=498** 不変 / lint errors=0。BUG-155 status=修正済。
- ⚠ **Workflow 事故 (重要教訓)**: 敵対verify workflow で `args` が**文字列で届き** chunk(args,10) が文字列を per-char
  スライス → ~1300バッチ → **1000-agent cap + session limit 到達 + 9.8M token 浪費**。以降 verify は自力テキスト読みで完遂。
  → 次回 Workflow で配列 args を渡すなら **冒頭 `const X = Array.isArray(args)?args:JSON.parse(args)` + 件数guard 必須**
  ([[feedback-workflow-args-string-blowout]])。

## 次にやること候補 (要ユーザー選択)
A) **auto-docs sync** (軽作業): structure.md/mapping が複数 wave 分未再生成 (precedent 通り未commit、CI除外)。
   `.claude/design` 等 hold-aside → `npm run docs` → structure.md/CHANGELOG/mapping を明示 add → commit → FF push。
   ※並行 session の B08075 等が docs に混入しうるので、自分の commit には auto-doc を含めるか慎重判断 ([[feedback-parallel-docs-contamination]])。
B) **MR Phase 2/3/4** (session55 設計から継続): Phase2=UI (PartnerArea PA-MR render+選択)、Phase3=AI (move-enumerator PA-MR 列挙)、
   Phase4=card wave (SOLE 15、B06066 read/mutate 非対称 再判定)。BUG-154 #4 (MR②×switch) は実カード遭遇時に公式Q&A 照会。
C) **カード追加 継続** (engine変更0): taskA pipeline で green候補刈り取り (card-wave skill)。残実数は inventory-remaining.cjs で再棚卸。
   ※B08075 wave (event-choose3) は出荷済。残 green候補は **novel 裾** (easy clone 枯渇 = clone-scan 0件) で 1枚ずつ certify 要。
   classify workflow の結果 (.tmp/fresh-127.json + tasks/wx7kuuzol.output) に GREEN 9/GATED 21/RISKY 8 の仕分けあり (38/127 のみ、session limit 中断)。
D) **engine 解禁 (additive)** で上記 6 DEFER を製造化: continuousModifier に lvlDelta 追加 (B08059/B08050) /
   carrier-reuse ($pick の sequence 跨ぎ bind) 保証+exemplar (B08023/B08033) / cost stunChar 追加 (B08004) / scope array 化 (B08019)。骨格凍結原則に注意。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済の運用)
- 着手前 working tree 確認 (他 session WIP / `.claude/design` ?? = 除外) / branch first。main 直 commit 禁止。
- 挙動不変ゲート: validate-specs (engine変更0) / tsc0 (`npm run typecheck`) / vitest (baseline 3037、1skip) /
  smoke:1000 + check:smoke-baseline (winsA=498) / 回帰テスト追加。
- **commit 運用**: pre-commit hook = `docs:check && 8 lints`。docs:check は他 session 未追跡カードで drift 落ち (CI除外) →
  **8 lints を手動緑確認 (lint:bugs/listener/card-addition/test-pair/side-channel/component-testid/ok-false-pattern/icon-abilities) → `git commit --no-verify`**。自分のファイルのみ明示 add (git add <files>、NOT -A)。
- **FF push**: 新 branch を現 HEAD から作成 → 明示 add → commit → `git push origin HEAD:main` (FF、branch切替なし)。
  remote が並行 session で進んでいても、現 HEAD がその上にあれば FF 成功 (542feac5 は 877ad627 上に積めた)。
- 決定論優先: agent 前に grep/node/hash で機械検証できないか必ず検討 (BUG-155 sweep は全て script + 自力テキスト読みで完遂、agent 0)。
- カード全文 TSV helper: `.tmp/_fulltext.cjs <ids>` / col10=effect col11=cutIn col12=hira col13=henso col16=qa。
- Bash heredoc `<<'EOF'` 使用。Read hook が file を line1 truncate → Bash cat/sed で読む / Edit 前に Read 1回で登録。
- ★memory.md は 80行で sessions/ へ rotate 済 (現 memory.md = thin、過去は sessions/2026-06-24.md)。
- DEFER 一覧: .claude/specs/DEFERRED-INDEX.md (白馬探 trio) / bug: .claude/bugs/index.base (BUG-155=修正済)。
```
