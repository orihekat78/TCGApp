# 次セッション再開プロンプト (2026-06-23 — evidence-flip 拡張 wave 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション㊻ — evidence-flip 拡張 wave を main へ ff-merge + push 済 = a8da02b0)
refactor-plan は全完了済。本セッションは **カード追加 (A)** の engine 拡張クラスタ。死 atom だった
evidenceFlip を additive 有効化し「証拠を表向きにする」5枚を出荷 (ALL_CARDS 1378→1383)。
- ★開始時に `git ls-remote origin main` で local HEAD (a8da02b0) 一致 + CI (`gh run list -L1`) green を確認。
  push 直後で CI 完走前にセッションを閉じた場合は green を見届ける。
- 直前㊺ (triggered-draw wave) は a1ca127b/1e4f41f8。㊻ 詳細は memory.md (80行 rotate 時は sessions/2026-06-23.md へ)。

## ㊻ サマリ (検証済: tsc0両 / vitest 2802→2822(+20) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約lint8本errors0)
残 unimplemented (671) を実テキストで密度検証 → **engine 不触 clean はほぼ枯渇** (散在 singleton のみ)。
最密 yield は evidence-flip 族と判明。evidenceFlip は engine に存在も **idx 固定形のみ=実カード文言で使えない
死 atom** (shipped 0) → ユーザー選択で **engine 拡張クラスタ** で additive 有効化。
- **engine 拡張** (additive 4 files、使用カード従来0=回帰ゼロ): core.ts atomEvidenceFlip に ①legacy idx 維持 +
  ②fromTop(上から=末尾) + ③pick-form(chooser=controller/side=証拠owner/faceDown限定) / atom-pick-spec.ts
  evidenceFlip(PB)+buildShortFormPick faceDown / candidates.ts evidence faceDown honor / types/effect.ts
  TargetQuery.faceDown (TargetFilter でなく Query 直下=sync test 対象外で3点同期回避)。
- **出荷 5** (hand-author、touched 各1): B07064 ワトソン(登場時pick) / B03076 世良真純(登場時fromTop+ヒラメキ) /
  B08085 シェリー(現場リムーブ時pick+cutin、事件青&黒+相手ターン中gate) / B09076・B09076P 三池苗子(疾風pick+cutin)。
- **decoy test** (tests/cards/wave-evidence-flip-2026-06-23.test.ts、20件): candidates faceDown filter+side解決 /
  runAtom fromTop・pick-resolved (bottom/自証拠 decoy) / leave caseColor・turn・疾風enterOrder gate / legacy idx 後方互換 /
  end-to-end (enter emit→runAllUntilEmpty→drainAiEffectPicks)。
- **敵対 faithfulness review** (opus workflow 6 agent = 5カード + engine lens): 全 faithful:true / blocker 0。
- **同族 DEFER** (DEFERRED-INDEX §evidence-flip wave): facedown「表向き証拠→裏向き」(B05013 等、flipFaceDown verb 要、
  次弾候補) / B06086/P (flip枚数count conditional) / B08028 (variable-count+linked pick) / B05079・PR279 (continuous gate) /
  B06034 (hirameki cascade)。事件 cost「証拠N つ表向き」(~20件) は既存 flipFaceUpEvidence cost で別 (effect でない)。

## 次にやること (要ユーザー選択)
A) **カード追加 継続**: ① engine 不触は枯渇気味 → 次は **engine 拡張クラスタ** が主力。最有望=**facedown verb**
   (flipFaceDown mutate + pick、本 wave faceup と対称、B05013 等 ~8件)。他 gate ファミリーは DEFERRED-INDEX 参照。
   ② 残 green tail から散在 clean を拾う場合は `.tmp/unshipped-greens.json` (154) + 671 unimpl scan。
   card-wave skill + (engine拡張なら手書き + decoy + 敵対review、green-harvest なら certify パイプライン)。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。engine 不触の dense family は枯渇しているので、A の場合は engine 拡張前提で提案する。

## プロセス必須 (engine 拡張カード wave の場合)
- **engine 拡張は additive + 回帰ゼロ厳守**: 使用カード0 の死 atom 有効化 or 新 verb/flag を「既存挙動不変」で。
  legacy 形 (test 依存) を必ず保持。新 query field は TargetQuery 直下 (TargetFilter は sync test 3点同期が要る)。
- engine 拡張カードは **codegen でなく手書き** (新 capability ゆえ)。exemplar 照合必須 (cutin=B02007 / 疾風=D11009 /
  leave=D01012 / enter observer=B07050)。member ごと TSV 全文再取得 (green master は truncate)。
- **decoy engine test 必須** (非 deck カードは playwright 不可): 新 engine path を decoy 込み 1対1 witness +
  end-to-end (hook emit → runAllUntilEmpty → drainAiEffectPicks)。BUG-117/118 教訓を engine 層で踏む。
- **敵対 faithfulness review** (opus workflow、1カード=1 lens + engine lens): カード文⇔DSL⇔engine の refute 試行。
- register: 手書きカードは `.tmp-taskA-registered.json` ([{id,pkg}]) → `node scripts/taskA-register.cjs "<batch>"`
  で _reuse/index.ts へ自動挿入 (手編集しない)。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2822) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124、3.2min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- pre-commit = docs:check + 規約 lint 8本。新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 →
  明示 add (CHANGELOG.md も) → commit。★Markdown は基本 100 行 / memory.md 80 行で sessions/ へ rotate (DEFERRED-INDEX は例外肥大)。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design。git add -A 禁止。
  ★lint:test-pair は per-card test path を warn (batch test=warn のみ非block)。★reports 新 smoke は gitignore 済 (policy E) ゆえ commit 不要。
  重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
