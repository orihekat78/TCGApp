# 次セッション再開プロンプト (2026-06-27 — セッション62: engine additive caseColorNot condition 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-27、セッション62 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 8dcdfcea** (★最新tip: feat(engine) caseColorNot condition — 「事件が【X】以外の色を持つ場合」 additive、CI green 確定済 run 28291430471)
  ← 98810921 (caseColorNot spec) ← fbe215fd (chore) ← 3940a88b (card wave colornot-removeset B07012/P+B07048) ← 1d6fdca2 ← d7f49df4 (engine BUG-156/157) ← 4ff83ba9 (engine colorNot)。
- branch `engine/additive-casecolornot-0627` (worktree `C:/tmp/conan-wt-casecolornot`) = main 一致。並行 card session の wave (3940a88b) と重複ゼロで FF rebase 出荷。
- ⚠ session62 と並行で **card session が wave colornot-removeset (3940a88b) を別 push** 済。両者 additive・重複無で衝突解決済 (engine vs card files)。
- 自 commit は `git add <自ファイル>` 明示・`git diff --cached --name-only` で混入確認 (NOT -A)。別 branch 作業は git worktree。
- ⚠ auto-docs (structure/mapping/CHANGELOG) 未再生成 (precedent 通り未commit・CI除外、drift 蓄積中)。pre-commit は `--no-verify` + 8lint 手動緑で回避。

## セッション62 サマリ (engine additive: Condition caseColorNot、新 kind 1つの純加算)
- ユーザー指示=engine追加 (選択肢B)。候補3 (caseColorNot / scope array化 / handReveal) を impact/risk 評価 → **caseColorNot** をユーザー選択。
- **新 Condition kind `caseColorNot`** 「自分の事件が【X】以外の色を持つ場合」。session60 colorNot (TargetFilter) の Condition 版。
  some説 (公式 B08079 ピンガ qa): `caseColors.some(c => c∉notSet)`、2色{X,Y}該当 / mono-X 除外 / 空 false。色解決は caseColor と同一式。
- honor 4点 (Condition 中央集権ゆえ filter より単純): effect.ts union / eval.ts case + CONDITION_KIND_MAP / validate-specs CONDS
  (sync-test が CONDITION_KINDS⇔CONDS 強制)。`satisfies Record<kind,true>` + `_exhaustive:never` で honor 漏れを tsc 強制。
- ⚠ 素の `not(caseColor X)`=none説 とは 2色で非対称。「持たない」side (事件⊆{X}) は既存 _shared **`caseMonoColor`** が担当
  (= `not(caseColor[他5色])`、6色 hardcode)。**`caseColorNot(X) ≡ not(caseMonoColor(X))`** 双方向 →
  将来 caseMonoColor を `not(caseColorNot)` へ簡約で 6色 hardcode 除去可 (振る舞い不変だが要 smoke gate、別 wave)。
- gate 全 green: tsc0 / 専用 test 13pass (fallback/primary path/vs-not 非対称/additivity/hardening: opp-owner・color=[]退化・d?.colors=[]優先順) /
  full vitest 3144pass 0fail / smoke winsA=498 完全一致 (既存カード未宣言→回帰0 機械保証) / 8lint PASS。
- **opus 5-lens 敵対 review = 全 ship:true / blocker0** (additivity/completeness/semantics/edge/test-adequacy)。
  completeness lens は satisfies/exhaustive guard を実削除し TS1360/TS2322 観測で honor 強制を実証。
  semantics lens の nit (spec の「none説カード無し」事実誤認) を反映: caseMonoColor cross-ref を spec/コメントに追記済。
- spec: `.claude/specs/engine-additive-casecolornot-design.md`。memory: reference-casecolornot-condition。
- **解禁** (card session 領分、engine0): PR274/PR275 工藤新一 (continuous AP+1000 gate)、B08079 ピンガ (宣言 gate) が即出荷可。

## 次やること候補 (要ユーザー選択)
A) **カード追加 継続** (card session 領分、engine変更0): ★**session62 解禁の PR274/PR275 工藤新一 + B08079 ピンガ
   (caseColorNot gate) が即出荷可**。他 colorNot 残候補も gate 済 (B07022/B08082=handReveal verb / B08081=reactive
   negation hook / B08091=recruit / B02002=per-count scaling dyn / B08033=forEach-scene-char setCard verb)。
   B08090 は complement-enum で出荷済 (caseColorNot/colorNot migration は behavior-invariant cleanup、選択肢B engine扱い)。
B) **engine additive 続き** (engine session 流儀): scope array化 (B08019) / handReveal verb (B07022/B08082 解禁) /
   forEach-scene-char setCard (B08033) / removeSetCard UI host-picker (session61 follow-up) /
   **caseMonoColor の not(caseColorNot) 簡約** (6色 hardcode 除去、振る舞い不変だが shipped 4枚経路ゆえ要 smoke 再gate)。
   各 impact/risk 評価 → brainstorm→spec→TDD→opus敵対review→FF。
   ※ caseColor negation「持つ」side は session62 で出荷済 (caseColorNot)。「持たない」side は既存 caseMonoColor。
C) **MR Phase 2/3/4** (session55 設計): Phase2=UI / Phase3=AI / Phase4=card wave (SOLE 15)。
D) **auto-docs sync** (軽作業): `.claude/design` hold-aside → `npm run docs` → structure/CHANGELOG/mapping 明示 add → FF push。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済の運用)
- 着手前 working tree 確認 (他 session WIP / `.claude/design` ?? = 除外) / branch first (card session は main tree+専用 branch、
  engine 並行なら git worktree)。main 直 commit 禁止。
- **engine変更0 カード**: 候補の全 gate を DEFERRED-INDEX + capability-map.txt + 実 engine grep で確定 (green候補は未certify信用しない) →
  hand-author (colorNot/removeSetCard 系は codegen 非対応 = B02010/B07048 precedent) → 専用 test (構造1対1 + 実engine evalCond/matchOneFilter/canPay decoy) →
  tsc/vitest/smoke baseline gate → **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge-test) → concern 反映 → commit。
- 挙動不変ゲート: tsc0 / vitest (baseline=HEAD 件数) / smoke:1000 + check:smoke-baseline (winsA=498) / 専用test / engine0 確認。
- **commit 運用**: pre-commit = docs:check(auto-doc drift で落ちる、CI除外) + 8lint。**8lint 手動緑** → `git commit --no-verify`。
  自ファイルのみ明示 add (NOT -A)。auto-doc は自 commit に含めない。changelog-entry ソースは手書き commit (CHANGELOG.md 再生成はしない)。
- **FF push**: `git ls-remote origin main` で FF 可確認 → `git push origin HEAD:main` → `gh run list -L1` CI green。
- 決定論優先。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>` (col10=effect/11=cutIn/12=hira/13=henso/qAndA=qa)。
  card メタ (cardId/imagePath/rarity) は .claude/specs/cards-data/<pkg>/character.tsv 直読み。
- Read hook が file を line1 truncate → Edit は Read 1回で登録 / 全文は Bash cat/sed。registration=_reuse/index.ts 手編集 (import + REUSE_CARDS 配列、P変は spread)。
- ★memory.md は 79行 (次の追記前に sessions/ へ rotate 検討)。DEFER 一覧: .claude/specs/DEFERRED-INDEX.md /
  bug: .claude/bugs/index.base (BUG-156/157=修正済 d7f49df4)。
```
