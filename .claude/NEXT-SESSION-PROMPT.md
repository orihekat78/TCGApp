# 次セッション再開プロンプト (2026-06-28 — engine additive 2件 + certify wave 0628 が並走)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-28)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 176e4cb8** (certify wave 0628 tip。私のengine commit ea5ee5a4/45f8c30c/624e17b9 は履歴下方=出荷済)。
- ⚠ **並行 session が複数稼働中・同一 working tree 共有**。git status は他 session WIP (auto-docs drift / NEXT-PROMPT /
  card-factory specs / `.claude/design` / `_probe_*.test.ts`) で汚れる → 自分のファイルだけ明示 add (NOT -A)。
  push 前に必ず **fetch→rebase origin/main→FF** (or 隔離 `git worktree add --detach`)。auto-docs/CHANGELOG は
  regen-unstaged 放置 (CI除外、precedent通り)。vitest は `--exclude "**/_probe_*"` で並行 probe を除外して判定。

## Thread A — engine additive (直近セッション、私)
- **$self.setCardCount dyn** (ea5ee5a4): resolveSelf に char-level 分岐追加 (`scene.byUid(uid).setCards.length`)。
  dyn token は sync registry 無し=honor site 単一。**B05030 遠山銀司郎 a2**「セット1枚につき AP+1000」継続を解禁し fully faithful 化。
  ★**実機検証済** (Playwright sampleGameState 注入: 2set→7000 / 0set→5000 / 1set+3stacked→6000、stacked 除外を確認)。
- **charSetCard{fromDeckTop} deck0 refresh** (45f8c30c, [[BUG-160]]): deck0 silent no-op (BUG-142 同族 latent bug) を
  draw/fileAdd 同型の deck0→refresh→set / remove0→deck-out 敗北 に修正。BUG-153 host-absent check は refresh 前に維持。
  単一 site で fromDeckTop 36カード被覆。smoke winsA=498 不変。
- ★**重要発見**: 旧 NEXT-PROMPT option-B「engine追加」4候補は **全て engine変更不要** と実 grep で判明
  (ability-presence=既存 keyword filter / $revealed色読み=既存 boundMatchesFilter+colorNot / forEach-scene setCard=既存 /
  caseMonoColor=既に not(caseColor(ALL\X)))。「解禁表記 stale」教訓。詳細 [[reference-setcardcount-and-setcard-refresh]]。

## Thread B — card-factory / certify wave (並行 session)
- **出荷 2枚** (certify wave 15→verified-green 2): B03035 大滝悟郎 (declared pay[sleepSelf,removeSetCard]→draw + ヒラメキ draw) /
  B04037 鈴木園子 (third-party contact:start trigger + chain[discard,charSetTurnEffect contactImmune] + ヒラメキ handAddFromRemove)。
- **certify queue 残 50/104** (`node scripts/taskA-next-chunk.cjs 15 15` で次 chunk offset 15)。
- **B09061 ジェイムズ = engine変更0 不可** (旧「単独解禁可」は誤り訂正済)。a1「FBI 3枚公開してもよい」= handReveal 短縮形 n:3 が
  候補<3 で all-or-nothing gate せず over-fire。残 gate = **handReveal exact-N gate** (engine additive)。
- card-factory T0/T1/T2 分類器 + fingerprint/exemplar tooling 出荷。結論: 現 unimpl pool に engine0-shippable ≈0
  ([[project-card-factory-tiered]])。新セット / engine 拡張待ち。

## 次やること候補 (要ユーザー選択)
A) **engine additive gap** (実 grep で確定済の真 gap、git worktree 隔離推奨):
   - **handReveal exact-N gate** (B09061/B07022 解禁。短縮形 n:N の候補<N all-or-nothing gate)。
   - certify 13 yellow の engine gate: set-card→証拠 / random-discard / turn-scope base-override / 遅延one-shot trigger /
     target==self gate / relative-color filter。
   - B08033 forEach 多枚set は **card-only** (charSetCard deck0 refresh 出荷済で Q&A faithful 可、engine変更0)。
B) **certify wave 続行** (card session、queue 残 50。green候補は未certify信用せず全 gate 実 engine grep)。
C) **MR Phase 2/3/4** (session55 設計): Phase2=UI / Phase3=AI / Phase4=card wave (SOLE 15)。
D) **auto-docs sync** (軽作業): drift hold-aside → `npm run docs` → structure/CHANGELOG/mapping 明示 add → FF push。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済)
- 着手前 working tree 確認 (他 session WIP 除外) / branch first (card=main tree+専用 branch、engine 並行=git worktree)。main 直 commit 禁止。
- **engine変更0 カード/「解禁」表記は stale 化しうる** → 候補の全 gate を DEFERRED-INDEX + 実 engine grep (eval.ts/effect.ts/candidates.ts 直読) で確定。
  既出荷/未実装は `git grep '<ID>' src/cards` で再確認 (PR274/275・B09061 誤認の教訓)。
- TDD: 専用 test (構造1対1 + 実engine evalCond/matchOneFilter/canPay/read.char.* decoy) → **opus 4-lens 敵対 review**
  (semantic/additivity/dsl-trap/edge-test) → concern 反映 → commit。
- 挙動不変ゲート: tsc0 / vitest (baseline=HEAD 件数、現 ~3245、`--exclude _probe_`) / smoke:1000 + check:smoke-baseline (winsA=498) / 8lint+eslint。
- **commit**: pre-commit=docs:check(CI除外)+8lint → 8lint 手動緑 → `git commit --no-verify -m "..." -- <自ファイル明示pathspec>`。
  auto-doc は自 commit に含めない。changelog-entry は手書き (`.claude/changelog-entries/<date>-NN-slug.md`、CHANGELOG.md 再生成しない)。
- **FF push**: `git fetch origin` → `git rebase origin/main` → `git push origin HEAD:main` → `gh run list -L1` CI green。
- 決定論優先。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>` (col10=effect/11=cutIn/12=hira/13=henso/qAndA=qa)。
  card メタ は .claude/specs/cards-data/<pkg>/character.tsv 直読み。
- Read hook が line1 truncate → Edit は Read 1回で登録 / 全文は Bash cat/sed。
- 実機検証 (Playwright MCP): 非MVPカードは sampleGameState fixture に temp 注入 → demo 読込 → DOM の `.ap`(read.char.ap実効値)
  実測 → revert。SceneArea が effective AP 描画 (BUG-110)。検証後 fixture revert + vite kill 必須。
- DEFER 一覧: .claude/specs/DEFERRED-INDEX.md (§handReveal=exact-N gap) / bug: .claude/bugs/index.base / memory: MEMORY.md。

## アーカイブ (過去セッション詳細)
- session63 (caseColorNot 実カード B08079 a3、main=80eea288) / session62 (caseColorNot Condition 8dcdfcea) /
  session61 (colorNot-removeset 3940a88b) / handReveal atom+revealFromHand cost (b8b1867c) は .claude/sessions/ + git log 参照。
```
