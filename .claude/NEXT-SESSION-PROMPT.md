# 次セッション再開プロンプト (2026-06-27 — セッション63: wave casecolornot カード B08079 a3 完成 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-27、セッション63 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 80eea288** (★最新tip: feat(cards) wave casecolornot-0627 — B08079/B08079P ピンガ a3 完成、engine変更0)
  ← 1720317f (chore session62 NEXT-PROMPT) ← 8dcdfcea (engine caseColorNot) ← 98810921 (caseColorNot spec) ← fbe215fd ← 3940a88b (card wave colornot-removeset)。
  ★push 後 CI in_progress (run 28292102979) → **開始時に green 確定を確認**。
- branch `cards/wave-casecolornot-0627` = main 一致 (本 session 作業 branch、main tree)。working tree clean (`.claude/design` ?? のみ=除外)。
- ⚠ 並行 session が複数稼働中 (git worktree 群: C:/tmp/conan-wt-*, .claude/worktrees/*)。push 時 remote が進みやすい →
  **必ず fetch→rebase origin/main→FF push** (本 session も 8dcdfcea base から 1720317f へ rebase してから push した)。
- 自 commit は `git add <自ファイル>` 明示・`git diff --cached --name-only` で混入確認 (NOT -A)。別 branch 作業は git worktree。
- ⚠ auto-docs (structure/mapping/CHANGELOG) 未再生成 (precedent 通り未commit・CI除外、drift 蓄積中)。pre-commit は `--no-verify` + 8lint 手動緑で回避。

## セッション63 サマリ (wave casecolornot-0627、engine変更0、既存カード a3 完成 +2 printings)
- ユーザー指示=engine変更0 カード追加 (選択肢A)。session62 (caseColorNot Condition) を実カードで de-risk。
- **B08079/B08079P ピンガ** (黒 char, 黒ずくめの組織): a1/a2 既出荷、**a3 のみ DEFERRED だったのを完成**。
  a3=【宣言】【スリープ】AP8000以下のキャラを1枚まで選びリムーブ。宣言ゲート=事件が【黒】以外の色を持つ場合。
  DSL: declared + condition{caseColorNot:黒} + cost{sleepSelf} + sceneRemove{side:either,max:1,cause:effect,filter:{apMax:8000}}。
- 全 primitive 出荷済 proven: caseColorNot(session62) / sleepSelf+sceneRemove(PR274 a2 同型, levelMax→apMax 差のみ) /
  apMax filter(D08003 a1 が literally apMax:8000 出荷済, 62 printings) / declared+condition+cost 複合(B07048 a2)。engine src 変更0。
- ★重要訂正: NEXT-PROMPT(session62) は「PR274/PR275 即出荷可」としていたが **PR274/PR275 は cluster13(2026-06-15)で出荷済**
  (complement-enum caseColor[赤緑黄黒白] 方式)。caseColorNot を実カードに要する未実装は **B08079 a3 のみ** だった (実 grep で確定)。
- gate 全 green: tsc0 / 専用 test 15pass (構造1対1 + caseColorNot宣言ゲート evalCond decoy[mono黒/2色/mono-X/空] +
  apMax matchOneFilter 境界[7000/8000/9000]+effective-AP[±2000] + sleepSelf canPay[active/sleep/stun]) /
  full vitest 3178pass 0fail / smoke winsA=498 不変 exceptions=0 (engine変更0 機械保証) / validate-specs B08079P=pass / 8lint err0 / eslint clean。
- **opus 4-lens 敵対 review = 全 ship:true / blocker0** (semantic/additivity/dsl-traps/edge-test)。edge-lens concern (sleepSelf スタン時不可 未pin) 反映し test +1。
  self-target (a1継続でbase7000→effective8000 が apMax圏内→自身選択可) は rules/15 自己選択可・PR274/D08003 と同 side:either で仕様準拠・非ブロッカー。
- spec: .claude/specs/engine-additive-casecolornot-design.md に B08079 ✅出荷済 を追記。changelog: 2026-06-27-06。

## 次やること候補 (要ユーザー選択)
A) **カード追加 継続** (card session 領分、engine変更0): caseColorNot 系は出荷完了 (B08079 a3 = 最後の未実装 caseColorNot カード)。
   残 colorNot/caseColorNot カードは全て **追加 engine gate** が必要で engine変更0 不可:
   B07022/B08082=handReveal verb / B08081=reactive negation hook / B08091=recruit / B02002=per-count scaling dyn / B08033=forEach-scene-char setCard。
   他 green 裾を taskA-next-chunk + catalog-survey で再選定 (green候補は未certify信用しない、全 gate を実 engine grep で確定)。
B) **engine additive 続き** (engine session 流儀, git worktree): handReveal verb (B07022/B08082 解禁) / forEach-scene-char setCard (B08033) /
   scope array化 (B08019) / removeSetCard UI host-picker (session61 follow-up) /
   caseMonoColor の not(caseColorNot) 簡約 (6色 hardcode 除去、振る舞い不変だが shipped 経路ゆえ要 smoke 再gate)。
   各 impact/risk 評価 → brainstorm→spec→TDD→opus敵対review→FF。
C) **MR Phase 2/3/4** (session55 設計): Phase2=UI / Phase3=AI / Phase4=card wave (SOLE 15)。
D) **auto-docs sync** (軽作業): `.claude/design` hold-aside → `npm run docs` → structure/CHANGELOG/mapping 明示 add → FF push。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済の運用)
- 着手前 working tree 確認 (他 session WIP / `.claude/design` ?? = 除外) / branch first (card session は main tree+専用 branch、
  engine 並行なら git worktree)。main 直 commit 禁止。**push 前に fetch→rebase origin/main** (並行 session で remote が進む)。
- **engine変更0 カード**: 候補の全 gate を DEFERRED-INDEX + capability-map.txt + 実 engine grep で確定 (★NEXT-PROMPT の「解禁」表記は stale 化しうる、
  既出荷/未実装は src/cards の実ファイル grep で再確認 = PR274/275 既出荷誤認の教訓) →
  hand-author (colorNot/caseColorNot/removeSetCard 系は codegen 非対応 = B02010/B07048/B08079 precedent) →
  専用 test (構造1対1 + 実engine evalCond/matchOneFilter/canPay decoy) → tsc/vitest/smoke baseline gate →
  **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge-test) → concern 反映 → commit。
- 挙動不変ゲート: tsc0 / vitest (baseline=HEAD 件数、現 3178) / smoke:1000 + check:smoke-baseline (winsA=498) / 専用test / engine0 確認。
- **commit 運用**: pre-commit = docs:check(auto-doc drift で落ちる、CI除外) + 8lint。**8lint 手動緑** → `git commit --no-verify`。
  自ファイルのみ明示 add (NOT -A)。auto-doc は自 commit に含めない。changelog-entry ソースは手書き commit (CHANGELOG.md 再生成はしない)。
- **FF push**: `git fetch origin` → `git rebase origin/main` → `git push origin HEAD:main` → `gh run list -L1` CI green。
- 決定論優先。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>` (col10=effect/11=cutIn/12=hira/13=henso/qAndA=qa)。
  card メタ (cardId/imagePath/rarity) は .claude/specs/cards-data/<pkg>/character.tsv 直読み。
- Read hook が file を line1 truncate → Edit は Read 1回で登録 / 全文は Bash cat/sed。registration=_reuse/index.ts 手編集 (import + REUSE_CARDS 配列、P変は spread)。
- ★memory.md は 79行 (並行 session 共有のため本 session は触れず、NEXT-PROMPT + auto-memory に記録)。DEFER 一覧: .claude/specs/DEFERRED-INDEX.md /
  bug: .claude/bugs/index.base (BUG-156/157=修正済 d7f49df4)。
```
