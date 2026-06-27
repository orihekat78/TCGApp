# 次セッション再開プロンプト (2026-06-27 — セッション60: engine additive colorNot filter 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意 (下記)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-27、セッション60 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 4ff83ba9** (engine additive colorNot filter、★最新tip) ← f935f505 (chore NEXT-PROMPT) ← 93eaef93 (card wave engine-unlocked-0624) ← dbbf434e (engine removeSetCard cost)。
  ⚠ 4ff83ba9 = **engine 変更あり (additive)**。push 後 CI in_progress (run 28289011611) → **開始時に green 確定を確認**。
- branch `engine/additive-colornot-filter-0627` = main 一致。
- 自 commit は `git add <自ファイル>` 明示・`git diff --cached --name-only` で混入確認 (NOT -A)。別 branch 作業は git worktree。
- ⚠ auto-docs (structure/mapping/CHANGELOG) 未再生成 (precedent 通り未commit・CI除外、drift 蓄積中)。
- 本 session は working tree clean (`.claude/design` ?? のみ=除外)、並行 card session の干渉なし。

## セッション60 サマリ (engine additive: TargetFilter colorNot)
- ユーザー指示=engine追加。候補4種を impact/risk 評価 → **colorNot filter** をユーザー選択 (cluster16 cardNameNot の color 版、純 additive・最低 risk)。
- brainstorming → spec (.claude/specs/engine-additive-colornot-filter-design.md) → TDD(RED→GREEN) → gate → opus 5-lens 敵対 review → concern 反映 → FF push を厳守。
- **新 TargetFilter field `colorNot`** (「【X】以外の色を持つキャラ」)。semantics は **公式 B08079 ピンガ qa で確定 (some説)**:
  「X以外の色を1つ以上持つ」(`colors.some(c => c∉notSet)`)。mono-X 除外 / 2色{X,Y} 該当。等価=全色が notSet 内のとき除外。
  ⚠ cardNameNot (any-match 除外) とは 2色で非対称。
- honor site 4点 (cardNameNot を mirror): 型(effect.ts) / matchOneFilter(candidates.ts) / boundMatchesFilter(cond/eval.ts) /
  targetFilterToPredicate(_shared.ts)。他 TargetFilter consumer は全て matchOneFilter/predicate へ委譲 → 自動 honored (review 確認)。
- **opus 5-lens 敵対 review = ship:true / blocker 0** (additivity/completeness/semantics/edge 全 CLEAN、test concern 1 を予防テスト3件で解消)。
- gate 全 green: tsc0 / 新テスト 13 / smoke winsA=498 不変 ex0 / full vitest 3105 pass / 8lint+eslint 0。
- **副産物 BUG-159 → 同 session で修正済 (84fc2bb3)**: 出荷済 **B02010(灰原哀)** が同一文言を custom closure
  `!colors.includes('青')` = none説で実装し 2色対象を公式違反で誤除外していた (review edge lens も独立確認) →
  `filter:{colorNot:'青'}` へ migration、card test 4 pass / smoke winsA=498 不変。
  ⚠ **残**: B08090 の complement-enum (`color:[他5色]`、some説で正だが 6色 hardcode で脆い) の colorNot 統一は別途 (振る舞い不変)。
- **colorNot 解禁カード** (card session 領分、engine0): B02002/B07012/B08081/B08082/B08090/B08091 等の「【X】以外の色」filter 句。各カードは他句 gate も要確認。

## 次やること候補 (要ユーザー選択)
A) **engine additive 続き** (本 session 流儀継続):
   - **scope array化** (B08019: on-scene+on-partner-area 併記、AbilityScope を array に)。MR scope reader 波及で risk 中。
   - **BUG-156/157 unified 修正** (sleepChar/stunChar cost over-pay の pick channel 配線 / read.char.ap/lp 無 guard
     相互再帰)。※非 additive ゆえ smoke 再ベースライン要・慎重に。
   - その他 additive gap (handReveal verb / caseColor の negation拡張「事件が【X】以外の色を持つ/持たない」B08079/PR274/275/cutin群)。
     ※ colorNot filter は session60 で出荷済、cardName-EXCLUSION は cluster16 cardNameNot で解消済。
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
