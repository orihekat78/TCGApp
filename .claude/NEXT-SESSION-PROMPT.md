# 次セッション再開プロンプト (2026-06-23 — triggered-draw wave 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション㊺ — triggered-draw wave を main へ ff-merge + push 済 = a1ca127b)
refactor-plan は全完了済。本セッションは **カード追加 (A)** で triggered-draw 族 4枚を出荷 (ALL_CARDS 1374→1378)。
- ★開始時に `git ls-remote origin main` で local HEAD (a1ca127b) 一致 + CI (`gh run list -L1`) green を確認。
  push 直後で CI 完走前にセッションを閉じた場合は green を見届ける。
- 直前㊹ (refactor Phase 4) は ff3a6d25。㊺ 詳細は memory.md (80行 rotate 時は sessions/2026-06-23.md へ)。

## ㊺ サマリ (検証済: tsc0両 / vitest 2783→2802(+19) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約lint8本 errors0)
残 green 154 を **実テキストで密度検証** (feedback-engine-cluster-over-green-tail: 残 green=novel 裾、密ファミリーは engine 拡張が製造)
→ **triggered-draw** 族 (反応型【ターン1】「〜したとき引く」) を engine 不触クラスタに選定。8 候補を `wf-certify.mjs`
(opus grounding→敵対verify、1.5M tok) → **green 4 / yellow 4**。
- **出荷 4** (codegen 3 + 手書き 1): B01071 ジェイムズ(action:declare 自/相手FBI) / B02079 千葉(contact:start 警察+ヒラメキ) /
  B03058 茶木(disguise:into excludeSource+ヒラメキ) / B07050 藤江(enter observer 小泉紅子 + cutin contactTargetMatches 手書き)。
- **spec 自己精査** (certify-spec-self-review 必須): green の payloadKey/excludeSource/matcherCondition が実 engine field
  + shipped exemplar (B04004 a3 / D04007 / B08048) で exercise 済を codegen 前に全句確認 (捏造フィールド無し確証)。
- **decoy 検証 test** (tests/cards/wave-trigdraw-2026-06-23.test.ts、19件): 非 deck カード (MVP 外) は playwright 不可 →
  実 hook を grounded payload で emit → pendingEffects/pendingHirameki で発火を decoy 込み検証 (BUG-117/118 を engine 層で踏む)。
- **yellow 4 DEFER** (DEFERRED-INDEX §triggered-draw wave): B01075/B01089 (除去キャラ自身を色で絞る trigger=leave payload に
  除去キャラ stat 無), B02062 (opp-evidence-removed observer hook 不在), B03008 (active→sleep state:change hook internal-only)。
  各ヒラメキ等副 ability は green だが main trigger が engine-gate ゆえ部分出荷=faithless で全体 DEFER。

## 次にやること (要ユーザー選択)
A) **カード追加 継続**: 残 green tail から次クラスタ。candidate 候補は `.tmp/unshipped-greens.json` (本セッション生成、154 rep)。
   engine 不触の同一パターン 5〜10 を 1 クラスタに。または engine 拡張クラスタ (DEFERRED-INDEX の gate ファミリーを解禁)。
   card-wave skill + certify パイプライン。capability 正本=catalog-survey-2026-06-06/capability-map.txt。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (カード追加の場合)
- card-wave skill (.claude/skills/card-wave) + card-addition-checklist.md。**certify 出力は自己精査必須** (verify-ok でも捏造
  フィールドを見逃す: certify-spec-self-review)。member ごと TSV 全文再取得 (green master の effect 列は truncate、ヒラメキ列漏れ注意)。
- パイプライン: collect-greens (全 .tmp/certify 走査、already-implemented skip) → validate-specs (engine変更0 保証) →
  codegen --write → register (.tmp-taskA-registered.json 経由、手書きカードは entry 追記)。手書き=needsManual は _shared closure 系。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2802) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124、3.2min) / pre-commit (docs:check + 規約 lint 8本)。非 deck カードは decoy engine test で「文言=処理」検証。
- engine 不触確認 (`git status src/engine` clean)。骨格凍結原則。touched files 各 ≤3。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- pre-commit = docs:check + 規約 lint 8本。新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add → commit。
  ★BUG を 修正済 にしたら frontmatter に date_fixed 必須。★Markdown 100 行 / memory.md 80 行で sessions/ へ rotate。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式)。除外: .claude/design/。git add -A 禁止。
  ★lint:test-pair は per-card test path を warn (batch test=warn のみ非block、cluster3 等の established pattern)。
  ★reports: 新 smoke は gitignore 済 (policy E) ゆえ commit 不要。重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
