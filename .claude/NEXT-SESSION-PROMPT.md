# 次セッション再開プロンプト (2026-06-29 — engine0 certify wave: 16枚出荷 + 歩留り40%確定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-29)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 26b6b94b** (engine0 certify wave 16枚 tip、CI 確認)。engine 群 = b34d33cc(on-set-host)/d03fa913(aura/turn-revoke)/2dd2e701/29ebc443/37000546 出荷済。
- ⚠ **並行 session 複数稼働・同一 working tree 共有**。git status は他 session WIP (auto-docs drift / NEXT-PROMPT /
  card-factory specs / `.claude/design` / `_probe_*.test.ts` / cards/wave-engine0-0628 等 divergent local branch) で汚れる →
  自分のファイルだけ明示 add (NOT -A)。**local cwd は stale branch ゆえ card/engine とも worktree off origin/main で作業**
  (本 session 中 main は 62eaf331→1a304d59→e3d4bddd と3回進んだ)。push 前 fetch→rebase→FF。vitest は `--exclude "**/_probe_*"`。

## 直近セッション (card、私) — engine0 certify wave (16枚出荷)
- ユーザー指示「engine変更0 のカード追加をまとめて」。worktree off origin/main (`cards/wave-engine0-0629`) で隔離作業。
- **出荷16枚** (main 26b6b94b): 15 base certify (wf-certify.mjs、SUB=5) = **6 verified-green / 2 refuted / 7 yellow = 40% 歩留り**。
  green = B06021(石川五右衛門)/B02057/B06004(工藤新一)/B06077/B03062/B04085 + 既 green B09056(赤井秀一) + 各 P-clone + 既出荷base の standalone P (B03088P/B07047P)。
- ★**歩留り確定**: 未certify150 は決定論 pre-screen で**全て複雑裾** (hirameki/keyword-grant cluster も各カードに重い主節)。
  clean uniform cluster は無い→ **一度に大量は不可能、per-card certify 必須**。adversarial verify(opus) が false-green 2件捕捉 (B03098/B06090)。
- ★**最大 lever = P-variant clone** (parallel=effect同一)。double-value base (base+P 両方未certify) を certify→各 green が2枚解禁。
  P-clone codegen = greens-for-codegen に rep=P 複製 append→`taskA-codegen --write` (metadata は cards-data TSV 自動取得、effect-text identity を col10-13 で機械照合)。
- ★**tooling fix**: `taskA-validate-specs.cjs` L163 の continuousModifier 許可キーが stale (apDelta/lpDelta のみ) →
  pure-JSON aura 群追加 (apDeltaAura/auraFilter/auraExcludeSelf/apDeltaAuraOpp 等)。B06004 = revealFromHand/apDeltaAura 初実利用カード。
- ⚠ **Workflow agent は main-repo cwd で grounding** (worktree 非対応、5-commit stale でも under-ship のみ=安全、worktree validate-specs が authoritative)。
  `.tmp` を worktree へ Copy-Item -Recurse は dest 既存だと入れ子→ Remove 後 clean copy。test の hand は `string[]`。詳細 [[reference-engine0-certify-wave-0629]]。

## 直近セッション (engine、別 session70) — on-set-host scope (set-card→host rider) READ infra
- 「engine拡張をできるだけ多く」指示 → 全561未実装中**最大の単一クラスタ**(装備イベント rider14+conferred8=22枚)の基盤を出荷 (**b34d33cc**, branch engine/bulk-additive-0629c, CI green)。
- 新 **AbilityScope `'on-set-host'`**: セットカード def の能力を faceUp セット中の host に適用。3 honor site = read/char.ts continuousDelta+keywords (継続 AP/LP/level/keyword、rider keyword=外部grant扱い) + listeners/triggered.ts handleHook (in-scene hook の triggered conferral) + lint-listener-scope ALLOWED_SCOPE。candidates 自動 honor (BUG-117)。挙動不変 (新scope grep0/faceDown除外/decoy実証、smoke winsA=498)。opus 4-lens (semantic+additivity=ship)。
- ★**READ infra ≠ end-to-end 解禁** (edge-test lens BLOCKER): **単独では実カード0枚**。残**最重要 WRITE side gate** = 使用 event を host.setCards へ faceUp 載せる **set-from-remove verb** (hand-use は event を必ず remove へ、かつ効果は remove 着地後解決)。これ揃えば継続 rider 14枚 (B02013/B06063 等) が end-to-end author 可。
- 残 DEFER (DEFERRED-INDEX §on-set-host): WRITE verb / leave:to-remove conferral (B05117、host splice 後 emit) / aura・restrictsOpponent rider 未 honor / rider triggered limit 衝突 (id card-unique 命名)。詳細 [[reference-engine-additive-on-set-host-0629c]]。
  「してもよい」+exact-N(n:{min,max}=3) は decline 非提示 = forced-reveal 容認 (strictly dominant、optional{}は AI後退)
  ([[reference-handreveal-human-path-and-b09061]] / [[project-engine0-clean-shortlist-wave]])。

## ★最優先候補: engine0 clean-shortlist wave 続行 (engine変更0、ユーザー指示)
- driver = [engine0-clean-shortlist-2026-06-29.md](specs/engine0-clean-shortlist-2026-06-29.md)。手順:
  1. shortlist「要 certify」3群の gate を engine 実測 → clean なら出荷:
     - **B02049/PR039 中森青子** = ally-action→**actioning-ally(そのキャラ)** buff の trigger-actor binding 有無
     - **B01035/D06009 大滝悟郎** = 【現場リムーブ時】**cause:contact** filter 有無
     - **B04092/B04093 キャンティ/コルン** = contact-trigger + self-sleep optional + AP buff (B03039 系か)
  2. 残 133 の未読 (~90枚) を `node .tmp/_fulltext.cjs <id>` で本文確認しつつ certify (SUB=8 直列)。
  3. 出荷ごとに spec triage 表更新 + registered.txt 再生成。

## 次やること候補 (要ユーザー選択)
A) **engine0 clean-shortlist wave 続行** (上記、最有力・ユーザー指示)。
B) **card-wave: stale-gate 解消済カード** (session69 由来、engine 既存で出荷可): B03033/B06068 + B08033/B08082/B08093/B07022。
   ★certify 必須 + ★Playwright human 経路 probe (carrier-reuse/pick-modal は AI-pass=false-green、[[feedback-carrier-reuse-human-path-empirical]])。
C) **engine additive gap** (薄い vein、worktree 隔離): PR136 charSetCard owner-deck / B05009 enterSource side-qualifier。
   他は DEFERRED-INDEX を origin/main 直読で再採寸してから。
D) **MR Phase 2/3/4** (session55 設計、Phase2=UI/3=AI/4=card SOLE15)。 E) **auto-docs sync** (drift hold-aside → docs → 明示 add → FF)。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済)
- 着手前 working tree 確認 / branch first (card も engine も **worktree off origin/main**、main 直 commit 禁止)。
  worktree= `git worktree add -b <br> /c/tmp/<dir> origin/main` + node_modules junction (engine/test 要時)。撤去は junction を rmdir → worktree remove (rm -rf 厳禁)。
- **「解禁」表記/DEFERRED-INDEX/分類器ラベルは stale 化しうる** → 候補の全 gate を実 engine grep (eval.ts/effect.ts/candidates.ts/read.char 直読)
  + `git grep '<ID>' src/cards` (origin/main) で既出荷確認。clean 判定は **shipped twin との全句突合**。
- TDD: 専用 test (構造1対1 + 実engine decoy、AI-drain だけでなく **human 経路 (applyPickAndContinuation / applyPickSkipAndContinuation /
  applyOptionalAndContinuation)** も踏む — AI-pass/comment 推論=false-green、[[feedback-carrier-reuse-human-path-empirical]]) →
  **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge)。worktree 絶対パス明示 ([[feedback-workflow-review-reads-cwd-not-worktree]]) → 反映 → commit。
- 挙動不変ゲート: tsc0 / vitest (baseline=HEAD 件数 `--exclude _probe_`) / smoke:1000 (winsA=498 不変=engine変更0 証跡) / 8lint+eslint。
- **commit**: 8lint 手動緑 → `git commit --no-verify -m "..." -- <自ファイル明示pathspec>`。auto-doc/CHANGELOG.md は自 commit に含めない。
  changelog-entry 手書き (`.claude/changelog-entries/<date>-NN-slug.md`、seq は既存と衝突回避)。P-variant は base test に meta assert で被覆 (test-pair WARN 容認)。
- **FF push**: `git fetch origin` → `git rebase origin/main` → `git push origin HEAD:main` → `gh run list -L1` CI green (~4min)。
- 決定論優先。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>`。Read hook line1 truncate → Edit は Read1回で登録/全文は cat。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。
- DEFER 一覧: .claude/specs/DEFERRED-INDEX.md / shortlist: specs/engine0-clean-shortlist-2026-06-29.md / bug: .claude/bugs/index.base / memory: MEMORY.md。

## アーカイブ (過去セッション詳細)
- session69 additive2件(d03fa913 aura/turn-revoke、[[reference-engine-additive-wave-0629b]]) / session68 additive5件(2dd2e701) /
  session67 additive3件(37000546) / handReveal exact-N(30228a13) / B09096 tierA(29ebc443) は .claude/sessions/ + changelog-entries + git log 参照。
```
