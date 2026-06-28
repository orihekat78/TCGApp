# 次セッション再開プロンプト (2026-06-28 — handReveal exact-N gate 出荷 + 並行 card session 稼働)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-28)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 30228a13** (handReveal exact-N gate tip。直近の engine commit 群=ea5ee5a4/45f8c30c/30228a13 は出荷済)。
- ⚠ **並行 session が複数稼働中・同一 working tree 共有**。git status は他 session WIP (auto-docs drift / NEXT-PROMPT /
  card-factory specs / `.claude/design` / `_probe_*.test.ts`) で汚れる → 自分のファイルだけ明示 add (NOT -A)。
  push 前に必ず **fetch→rebase origin/main→FF** (engine 並行は `git worktree add` で隔離推奨)。auto-docs/CHANGELOG は
  regen-unstaged 放置 (CI除外、precedent通り)。vitest は `--exclude "**/_probe_*"` で並行 probe を除外して判定。

## 直近セッション (engine、私) — handReveal exact-N gate
- **handReveal exact-N gate** (30228a13): 短縮形 `n:N` (=「N枚公開する」固定数 rules/15「まで」なし=all-or-nothing) で
  手札の filter 一致候補が N 枚未満なら公開不可と判定し `chainStepNoApply` で「そうした場合」後続を gate。旧 over-fire
  (候補<N でも available を公開 → count>0 → 後続発火) を修正。判定は **短縮形 entry の候補数** (`targetCandidates`) で行う
  ← drain 経路 (apply-pick generic Pattern B) が resolved target を**単一 collapse** するため resolved length では <N 検出不可。
  reveal=zone 不変ゆえ availability さえ満たせば後段 collapse でも mechanical 等価。core.ts atomHandReveal + test §10a-g。
  opus 3-lens 敵対 review (worktree 直読) = 全 ship。tsc0/vitest3272/8lint0/smoke winsA=498 不変 ([[reference-handreveal-atom-revealfromhand-cost]])。
- ★**B09061 a1「FBI を3枚公開してもよい。そうした場合引く」が engine変更0 で出荷可能化** (handReveal exact-N + draw +
  既存 handAddFromRemove ヒラメキ)。「単独解禁可」誤認 → exact-N gate が真の残 gate だった。
- ⚠ exact-N gate **未対応 4 組合せ** (B09061 は全て無害、将来カードで gate 拡張要): distinctNames+n / 明示配列+n /
  n≥2+bind / dyn-filter+n。core.ts コメント + DEFERRED-INDEX §handReveal 明記。
- ⚠ プロセス教訓: worktree のengine変更を Workflow review に出すと agent が **親cwd(main repo)をgrepし「未実装」誤block**。
  worktree絶対パス明示+`git -C`裏取り強制、2ラウンド構成想定 ([[feedback-workflow-review-reads-cwd-not-worktree]])。

## 並行 session — card-factory / certify wave
- certify queue 残 50/104 (`node scripts/taskA-next-chunk.cjs 15 15`)。13 yellow は engine gate 待ち。
- card-factory T0/T1/T2 分類器 + tooling 出荷。現 unimpl pool に engine0-shippable ≈0 ([[project-card-factory-tiered]])。

## 次やること候補 (要ユーザー選択)
A) **B09061 a1 カード出荷** (engine変更0、自然な続き): handReveal exact-N + draw + handAddFromRemove ヒラメキ。
   card session (main tree + 専用 branch)。★**Playwright human 経路 probe 必須** (FBI 2枚で公開 modal が exact-3 強制 →
   draw 不発火、FBI 3枚で公開 → draw を実機確認。AI-pass=false-green、[[feedback-carrier-reuse-human-path-empirical]])。
B) **engine additive gap 続行** (git worktree 隔離): certify 13 yellow の engine gate (set-card→証拠 / random-discard /
   turn-scope base-override / 遅延one-shot trigger / target==self gate / relative-color filter)。handReveal companion
   (ability-presence filter=B08082/B08093、$revealed 色読み=B07022) も残。
C) **certify wave 続行** (card session、queue 残 50。green候補は未certify信用せず全 gate 実 engine grep)。
D) **MR Phase 2/3/4** (session55 設計): Phase2=UI / Phase3=AI / Phase4=card wave (SOLE 15)。
E) **auto-docs sync** (軽作業): drift hold-aside → `npm run docs` → structure/CHANGELOG/mapping 明示 add → FF push。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済)
- 着手前 working tree 確認 (他 session WIP 除外) / branch first (card=main tree+専用 branch、engine 並行=git worktree、main 直 commit 禁止)。
- **engine変更0 カード/「解禁」表記は stale 化しうる** → 候補の全 gate を DEFERRED-INDEX + 実 engine grep (eval.ts/effect.ts/candidates.ts 直読) で確定。
  既出荷/未実装は `git grep '<ID>' src/cards` で再確認。
- TDD: 専用 test (構造1対1 + 実engine evalCond/matchOneFilter/canPay/read.char.* decoy、短縮形→drain 経路で false-green 回避) →
  **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge-test) → concern 反映 → commit。
- 挙動不変ゲート: tsc0 / vitest (baseline=HEAD 件数、現 ~3272、`--exclude _probe_`) / smoke:1000 + check:smoke-baseline (winsA=498) / 8lint+eslint。
- **commit**: pre-commit=docs:check(CI除外)+8lint → 8lint 手動緑 → `git commit --no-verify -m "..." -- <自ファイル明示pathspec>`。
  auto-doc は自 commit に含めない。changelog-entry は手書き (`.claude/changelog-entries/<date>-NN-slug.md`、CHANGELOG.md 再生成しない)。
- **FF push**: `git fetch origin` → `git rebase origin/main` → `git push origin HEAD:main` → `gh run list -L1` CI green。
- 決定論優先。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>` (col10=effect/11=cutIn/12=hira/13=henso/qAndA=qa)。
- Read hook が line1 truncate → Edit は Read 1回で登録 / 全文は Bash cat/sed。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。
- engine 並行 worktree: `git worktree add -b <branch> /c/tmp/<dir> origin/main` + node_modules junction → 作業 → FF push → worktree remove。
- DEFER 一覧: .claude/specs/DEFERRED-INDEX.md (§handReveal=exact-N gate ✅出荷/未対応4組合せ) / bug: .claude/bugs/index.base / memory: MEMORY.md。

## アーカイブ (過去セッション詳細)
- session64 (B03035/B04037 certify wave、main=176e4cb8) / session63 (caseColorNot 実カード B08079 a3) /
  setCardCount dyn + charSetCard refresh (ea5ee5a4/45f8c30c) / handReveal atom+revealFromHand cost (b8b1867c) は
  .claude/sessions/ + git log 参照。
```
