# memory — 現セッション scratchpad

> ㊶〜㊸ (Phase 3e/3f/3g) は [.claude/sessions/2026-06-22-4.md](sessions/2026-06-22-4.md) へ退避。

## セッション㊹ (2026-06-22) — refactor Phase 4 完了 (周辺整理、refactor-plan 全完了)
Phase 3g は main 取込み済 (841cfbc0, CI green)。ユーザー選択で Phase 4。branch `refactor/phase-4`。engine 不触・低リスク。
- **着手前 grounded 調査 = Workflow opus 4 lens 並列** (scripts/specs/_reuse/sessions・reports、358k tok) で**計画 stale を 2 点是正**:
  ① 「survey 4本」→ 実 one-off **14本** (survey9 + taskA-wave1/2/3-specs + wf-gate5-batch4 + fix-bug140) を無参照 grounded 確認の上 `scripts/_archive/` へ git mv。
    HARD-KEEP 罠: taskA-validate-specs.cjs は tests/engine/sync-taskA-whitelists.test.ts:36 が読込 (archive 厳禁)。scripts/tsconfig に `exclude:["_archive"]`。
  ② 「specs 2026-05-11 stale→archive」→ 13本は **全 CURRENT_KEEP** (live `// spec` 参照 + INDEX/HUB/tests) ゆえ **archive せず**。
- `_reuse/index.ts` ヘッダ de-churn (294件 stale → 「正準=REUSE_CARDS 配列長, 現802枚」、import/export コード不変)。
- reports=**policy E** (ユーザー裁定): dated smoke を gitignore `/.claude/reports/smoke-*` + baseline allowlist `!smoke-baseline.json`、既存 tracked 298 を `reports/_archive/` へ git mv (履歴保持)。新 smoke は直下→ignore で untracked ノイズ消滅 (62→0)。sessions=現状維持 (ユーザー裁定)。
- **1 lens 敵対レビュー** (opus): 挙動 A/B/C/D PASS。E (spec の移動 script パス link 切れ 2件→`_archive/` パス修正済) + F (structure.md 再生成=docs 解消) を解消。
- **ゲート全 GREEN**: tsc0(両) / vitest 2783+1skip / smoke winsA=498(exc0/baselineOK) / e2e 26 / eslint 125(added0) / 規約lint8本0。

### 学び㊹
- 周辺整理でも「計画記載の対象数」は陳腐化する (4本→14本、specs 全 stale→全 current)。**着手前に grounded 調査で実態を再確認**してから move する。
- 1回限り script の archive は「無参照」の grounded 確認が要 (package.json/ci.yml/SKILL.md/start.bat/**tests の readFileSync**)。CI test が script を fixture 読みする罠あり。
- ファイル move は **active docs の reproduce-command パス link 切れ**に注意 (history log は不変記録ゆえ除外可)。provenance JSON の generatedFrom は当時の記録ゆえ据置。

### commit㊹ / 次
明示 add (3 src/config[.gitignore/scripts tsconfig/_reuse] + 移動群[scripts/_archive・reports/_archive] + 記録 md + auto docs、.claude/design 除外) → 1 commit → main ff-merge → push → CI green。
**refactor-plan (1a〜4) 全完了。** 次: デザイン刷新 (.claude/design/RESUME.md) / カード追加 (DEFERRED-INDEX) を要ユーザー選択。`/clear` 推奨。

## セッション㊺ (2026-06-23) — triggered-draw wave (カード追加 A、engine変更0)
ユーザー選択=カード追加(A)。残 green 154 を実テキストで密度検証 → **triggered-draw** 族 (反応型【ターン1】「〜したとき引く」) を engine 不触クラスタに選定 (feedback-engine-cluster-over-green-tail: 残 green は novel 裾ゆえ実テキストで密度検証してから選ぶ)。branch `cards/wave-trigdraw`。
- **certify** 8候補 `wf-certify.mjs` (opus grounding→敵対verify、1.5M tok) → **green 4 / yellow 4**。
- **spec 自己精査** (certify-spec-self-review): green 4 が使う `payloadKey`/`excludeSource`/`matcherCondition` が実 engine field (effect.ts:79 / eval.ts:316,332 / card-def.ts:61、Task D E2/E4) かつ shipped exemplar (B04004 a3 dual-gate / D04007 / B08048) で exercise 済を全句確認 → 捏造フィールド無し確証。enter-observer (B07050 a1) は shipped twin 無いが handleHook が in-play 全走査ゆえ非selfOnly enter は任意登場で発火 (triggered.ts:223/227) を engine code で確認。
- **出荷 4** (ALL_CARDS 1374→1378): B01071/B02079/B03058 = codegen 自動 / B07050 = needsManual (cutin contactTargetMatches closure、D10011同型 手書き)。touched=各1。
- **decoy 検証 test** (tests/cards/wave-trigdraw-2026-06-23.test.ts、19件 pass): 実 hook を grounded payload で emit → pendingEffects/pendingHirameki で発火を decoy 込み検証。trait/色/excludeSource/cardName/turn-gate/action[事件]除外 全て語義通り gate。
- **yellow 4 DEFER** (DEFERRED-INDEX §triggered-draw wave): B01075/B01089 (除去キャラ自身を色で絞る trigger=leave payload に除去キャラ stat 無), B02062 (opp-evidence-removed observer hook 不在), B03008 (active→sleep state:change hook internal-only)。各 ヒラメキ等副 ability は green だが main trigger gate ゆえ部分出荷=faithless で全体 DEFER。
- **ゲート**: tsc0(両) / vitest 2783→2802(+19) / smoke winsA=498(exc0/baselineOK、4枚 MVPデッキ外ゆえ不変=engine変更0証跡) / e2e / 規約lint。engine 不触 (`git status src/engine` clean)。

### 学び㊺
- 残 green master の effect 列は **truncate されている** (PR265 は「レベル分リムーブ」隠れ gate で既 DEFER だった)。member ごとに repRecord 全文 + ヒラメキ列を再取得必須 (6枚に隠れヒラメキ判明)。
- 非 deck カード (MVP 外) の「画面処理=文言」検証は playwright 不可 → **実 hook emit + decoy の engine test** が等価 (BUG-117/118 教訓を engine 層で踏む)。hirameki は pendingHirameki 側チャネル (pendingEffects でない)。
