# 次セッション再開プロンプト (2026-06-29 — engine additive wave 0629b 出荷 + DEFERRED-INDEX 大量stale 判明)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-29)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = d03fa913** (engine additive wave 0629b tip)。直近 engine commit 群 = 2dd2e701(additive5件)/29ebc443(B09096)/
  37000546(additive3件)/d03fa913(additive2件) は全て出荷済。
- ⚠ **並行 session 複数稼働・同一 working tree 共有**。git status は他 session WIP (auto-docs drift / NEXT-PROMPT /
  card-factory specs / `.claude/design` / `_probe_*.test.ts` / cards/wave-engine0-0628 等の divergent local branch) で汚れる →
  自分のファイルだけ明示 add (NOT -A)。push 前に必ず **fetch→rebase origin/main→FF**。engine 並行は `git worktree add` で隔離必須
  (local cwd は divergent ゆえ engine grounding/impl は worktree off origin/main で行う)。vitest は `--exclude "**/_probe_*"`。

## 直近セッション (engine、私=session69) — additive wave 0629b
- **cross-side 数値 aura** (`continuousModifier.apDeltaAuraOpp/lpDeltaAuraOpp/auraFilterOpp`): read.char.auraDelta が target と
  反対side の bearer も走査 (cluster13 aura=同side限定だった)。honor site (read.char.ap/lp + candidates.matchOneFilter) +
  再帰guard auraDeltaSafe 共有、新site無。→ **B03033** 解禁 (相手の現場のセット済キャラ AP-1000)。
- **印字キーワード turn-revoke** (`revokedKeywords` turnEffect + `revokeKeywordTurn` + `charRevokeKeyword scope:'turn'`):
  read.char.keywords が **印字(base)+自前continuous のみ減算**、granted/turnGranted (外部付与) は非減算 → 再付与で復活
  (公式B06068 Q&A)。既定 permanent は従来 granted-splice 不変、charRevokeKeyword 既存caller 0。→ **B06068** 解禁。
- tsc0/vitest3341-0fail(新規11)/smoke winsA=498 全項目baseline不変/8lint+eslint/opus 4-lens 敵対review 全ship・blocker0
  (semantic の re-grant 復活指摘を出荷前 refine)。worktree off origin/main で全工程 ([[reference-engine-additive-wave-0629b]])。

## ★最大の教訓: DEFERRED-INDEX が大量 stale
- 旧 yellow「engine gap」の多くが既出荷だった → **origin/main ソース直読で再採寸必須** (index/「解禁」表記 信用不可):
  removeSetCard cost(B08033) / lvlDelta(B08050) / handReveal+revealFromHand cost / ability-presence filter
  `defHasKeyword('【現場リムーブ時】')`(B08082/B08093) / boundMatchesFilter cond + handReveal `bind`(B07022) /
  enterSource cond(viaEffect+sourceFilter) は **全て実装済** → これら参照の DEFER は card-wave 案件 (engine不要)。
- session69 で真に engine 拡張要だったのは **2件のみ**。engine vein は薄い。

## 次やること候補 (要ユーザー選択)
A) **card-wave (最有力・生産的)**: engine 既存で出荷可能なカード多数 = B03033/B06068 (本wave解禁) + B08033/B08082/B08093/B07022
   (stale gate 解消済)。card session (main tree + 専用 branch)。★certify 必須 + ★**Playwright human 経路 probe**
   (carrier-reuse/pick-modal は AI-pass=false-green、[[feedback-carrier-reuse-human-path-empirical]])。
B) **engine additive gap 続行** (薄い vein、git worktree 隔離): 非clean-additive で session69 見送り = PR136 charSetCard
   owner-deck (pick後 deck-source 解決要) / B05009 enterSource side-qualifier (enter payload に sourcePlayer emit 要)。
   他の真gap候補は DEFERRED-INDEX を origin/main 直読で再採寸してから。
C) **certify wave 続行** (card session)。D) **MR Phase 2/3/4** (session55 設計、Phase2=UI/3=AI/4=card SOLE15)。
   E) **auto-docs sync** (drift hold-aside → `npm run docs` → 明示 add → FF push)。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済)
- 着手前 working tree 確認 / branch first (card=main tree+専用branch、engine=worktree off origin/main、main 直 commit 禁止)。
- **「解禁」表記/DEFERRED-INDEX は stale 化しうる** → 候補の全 gate を実 engine grep (eval.ts/effect.ts/candidates.ts/read.char 直読) で確定。
  既出荷/未実装は `git grep '<ID>' src/cards` で再確認。engine 拡張は **本体が共有subsystemを1回読む** 方が redundant grounding-agent より token効率良い。
- TDD: 専用 test (構造1対1 + 実engine evalCond/matchOneFilter/canPay/read.char.* decoy、短縮形→drain で false-green 回避) →
  **opus 4-lens 敵対 review** (semantic/additivity/recursion-perf/dsl-edge)。review packet は diff+test を **scratch 絶対パス**に embed +
  worktree絶対パス明示 (agent の cwd-grep 誤判定回避、[[feedback-workflow-review-reads-cwd-not-worktree]]) → concern 反映 → commit。
- 挙動不変ゲート: tsc0 / vitest (baseline=HEAD 件数 `--exclude _probe_`) / smoke:1000 + check:smoke-baseline (winsA=498) / 8lint+eslint。
- **commit**: 8lint 手動緑 → `git commit --no-verify -m "..." -- <自ファイル明示pathspec>`。auto-doc は自 commit に含めない。
  changelog-entry 手書き (`.claude/changelog-entries/<date>-NN-slug.md`、CHANGELOG.md 再生成しない)。
- **FF push**: `git fetch origin` → `git rebase origin/main` → `git push origin HEAD:main` → `gh run list -L1` CI green。worktree remove + junction は rmdir (rm -rf 厳禁)。
- 決定論優先。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>`。Read hook line1 truncate → Edit は Read1回で登録/全文は cat。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。
- DEFER 一覧: .claude/specs/DEFERRED-INDEX.md (§0629b wave + stale監査) / bug: .claude/bugs/index.base / memory: MEMORY.md。

## アーカイブ (過去セッション詳細)
- session68 additive5件(2dd2e701、[[reference-engine-additive-wave-0629]]) / session67 additive3件(37000546) /
  handReveal exact-N gate(30228a13) / B09096 tierA(29ebc443) は .claude/sessions/ + changelog-entries + git log 参照。
```
