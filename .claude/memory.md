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

## セッション㊻ (2026-06-23) — engine拡張 wave evidence-flip-faceup (カード追加 A 継続)
ユーザー選択=A 継続 + 「evidence-flip 拡張」(engine 拡張クラスタ)。残 unimplemented (671) 密度検証で engine 不触 clean は薄く散在 (残弾枯渇) と確認 → 最密 yield=evidence-flip 族。`evidenceFlip` は engine 存在も **idx 固定形のみ=死 atom** (shipped 0) と判明。branch `cards/wave-evidence-flip`。
- **engine 拡張** (additive 4 files、回帰0=使用カード0): core.ts atomEvidenceFlip に ② fromTop(上から=末尾) ③ pick-form(chooser=controller/side=証拠owner/faceDown限定) 追加 (① legacy idx 維持) / atom-pick-spec.ts evidenceFlip PB + buildShortFormPick faceDown pass / candidates.ts evidence で query.faceDown honor / effect.ts TargetQuery.faceDown (TargetFilter でなく Query 直下=sync test 対象外)。
- **出荷 5** (ALL_CARDS 1378→1383、touched 各1): B07064(登場時pick) / B03076(登場時fromTop+ヒラメキ) / B08085(現場リムーブ時pick+cutin、事件青&黒+相手ターン中gate) / B09076・B09076P(疾風pick+cutin)。hand-author (engine拡張カードは新capability ゆえ codegen でなく手書き、exemplar B02007/D11009/D01012/B07050 照合)。
- **decoy test** (tests/cards/wave-evidence-flip-2026-06-23.test.ts、20件): candidates() faceDown filter + side解決 (face-up/自証拠 decoy) / runAtom fromTop・pick-resolved (bottom/自証拠 decoy) / leave caseColor・turn・疾風enterOrder gate / legacy idx 後方互換 / end-to-end (enter emit→runAllUntilEmpty→drainAiEffectPicks)。
- **敵対 faithfulness review** (opus workflow、5カード lens): 全 faithful:true / blocker 0。
- **ゲート全 green**: typecheck 0(両) / vitest 2802→2822(+20) / smoke winsA=498 exc0 baselineOK (MVP挙動不変=回帰0証跡) / e2e 123pass+1skip。

### 学び㊻
- sweep bucket label は過剰グルーピング (feedback-engine-cluster-over-green-tail 実証): 「TOP-flip 21」の大半は事件カードの **【宣言】cost「証拠N つ表向きにする」= 既存 flipFaceUpEvidence cost** で effect でない誤検出。cost bracket 〚〛 を strip して effect だけ再 scan が必須。
- engine に **存在するが実カード文言で使えない死 atom** がある (evidenceFlip idx固定形)。capability-map に列挙されていても「実カードが使える形か」を実 handler で確認要。additive 有効化で dense family 解禁。
- 新 query field は **TargetFilter でなく TargetQuery 直下** に置けば sync-taskA-whitelists.test (TargetFilter キーを Exclude<custom> で強制) を回避でき 3点同期不要。

## セッション㊼ (2026-06-23) — engine拡張 wave evidence-flip-facedown (㊻ の対称)
ユーザー指示「あと何枚?」→ 棚卸 (scripts/inventory-remaining.cjs 新規、決定論クラスタ): 残 **666** 未実装。粗 regex の「clean 520」は **信用不可** (reusable-306 過大評価の罠を再現、sceneHas タグだけで clean 判定 + sole-gate 帰属が harder gate 見逃しで壊れる、サンプルで実証)。真 yield は positively-matched gate のみ信頼。facedown 真 clean=4枚と確定 → ユーザー「facedown wave 進行」。branch `cards/wave-facedown`。
- **engine 拡張** (additive 9 files、回帰0=使用カード0): 新 verb `evidenceFlipDown`。core.ts atomEvidenceFlipDown=handAddFromRemove 鏡像 3-path (cardIds await / cardIds resolved multi loop / single short-form) / mutate/evidence.ts flipFaceDown(faceUp false のみ=順番不変) / candidates.ts evidence faceUp filter / effect.ts TargetQuery.faceUp + AtomVerb union / pick-spec + validate + cjs whitelist (3点同期) / **resolve-picks.ts CPU multi-pick 分岐に evidence kind 追加** (隠れバグ: 従来 `c.kind==='card'` 限定で evidence 候補除外 → cardIds 空 → flip されず。human path は BUG-076 対応済、CPU 欠落)。
- **出荷 4** (ALL_CARDS 1383→1387、touched 各1): B05013 灰原哀(登場時 2まで multi-pick + ヒラメキ) / B06017・B06017P 天草四郎時定(登場時 sceneHas YAIBA excludeSelf→draw + ヒラメキ + 変装[caseTrait YAIBA/fileAtLeast5]) / B06019 クモ男(【事件編】caseStatus gate + chain[discard 緑YAIBA, draw2] + ヒラメキ)。hand-author、exemplar B07064/B03076(faceup) + B02038(変装) + B02077(conditional sceneHas) + D08003(discard chain) 照合。
- **decoy test** (tests/cards/wave-evidence-flip-facedown-2026-06-23.test.ts、23件): candidates faceUp filter / runAtom single・multi(cardIds)・同cardId2件・0枚・裏向きtarget-noop / 順番不変 / pick-await enqueue / B05013 enter multi-pick e2e / B06017 excludeSelf gate fire-skip / B06019 caseStatus fire-skip + chain / legacy faceup 回帰。
- **敵対 faithfulness review** (opus 4 lens): 全 faithful:true / blocker 0。engine lens で D08021 既存 multi-pick 回帰 5/5 pass 確認。
- **ゲート全 green**: tsc 0(両) / vitest 2822→2845(+23) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約 lint 8本 errors=0。

### 学び㊼
- **棚卸の「clean」過大評価は再発する罠** (project-reuse-recalibration 同型): 粗 regex は ~25 mechanic しか見ず、trigger hook タグだけで clean 判定 → 実 effect が codeable とは限らない + sole-gate 帰属が見逃し harder gate で壊れる。**真 yield は positively-matched gate のみ信頼、member ごと certify 必須**。
- **multi-pick (cardIds:'$pick.cardIds') の CPU 解決は area kind 依存**: resolve-picks の CPU 分岐は `c.kind==='card'` 限定だった (D08021/B09034 が remove area=card kind ゆえ顕在化せず)。新 area (evidence) の multi-pick は CPU path に kind 追加が必須。human path (BUG-076) とは別経路。**新 area で multi-pick するなら CPU 分岐も確認せよ**。
- evidence pick uid=`evidence:<side>:<idx>` (index-based) → 同 cardId 複数も別 uid で選択可。handler は findIndex(cardId && faceUp) loop で flipFaceDown が次個体を拾い正しく区別。

## セッション㊽ (2026-06-23) — engine拡張 wave deck-mill-gated-chain (カード追加 A 継続)
ユーザー選択=A 継続。残未実装を 4候補クラスタ (deck-mill / set-event / opp-evidence / hand-count) で opus grounding 棚卸 (Workflow 並列) → deck-mill-gated-chain が最小 additive (engine 1 file) ×真 clean 4枚 ×low risk と確定。branch `cards/wave-deck-mill-gated-chain`。
- **engine 拡張** (additive 1 file=core.ts atomMill、回帰0=gate 使用カード従来0): `mill{gate:true}` 分岐。deck<N で何もリムーブせず chainStepNoApply→chain break = 公式Q&A all-or-nothing (filePopToHand/evidenceToHand 同型)。gate 未指定/false は従来挙動 (可能な限り mill+refresh、B09064/B09104) 完全保持。args=unknown 型ゆえ union/validate/whitelist 3点同期不要。
- **出荷 4+P4** (ALL_CARDS 1387→1395、touched 各1): B01044 怪盗キッド (登場時 gated-mill7→キャラ deck下、condition partnerColor白) / B03094 萩原千速 (突撃 partnerColorKeyword + 無条件 action:declare gated-mill2→AP+1000 action-scope、【ターン1】無) / B05061 終極 event (event-use + partnerColor白 + gated-mill7→相手キャラ deck下) / B06016 鬼丸猛 (登場時 partnerColor緑 gated-mill3→AP8000以下 remove + 宣言 turn1 sleepSelf 証拠⇄手札 swap=B06029 同型 bare chain)。hand-author、exemplar B02003(partnerColor+登場時+sceneToDeck)/D01005(partnerColorKeyword)/D01014(event-use)/D04007(optional chain)/D02004(charModifyAP $self)/B06029(evidence swap) 照合。
- **DEFER**: B02052/P トランプ銃 (set-event の permanent grant 未検証 + replace-on-set-card-removal hook 不在)。DEFERRED-INDEX §deck-mill-gated-chain。
- **decoy test** (tests/cards/wave-deck-mill-gated-chain-2026-06-23.test.ts、23件): runAtom mill gate (deck≥N/deck<N/境界 deck==N) / legacy gate-less 回帰 (B09104 shape) / chain[mill(gate),draw] consequence decoy で chain-break witness / optional gating / per-card 固有 N / B03094 a2 golden full (gate+AP両 deterministic) / DSL 構造断言 / parallel 同一性。
- **敵対 faithfulness review** (opus 5 lens=engine+4カード): 全 faithful (blocker 0)。B05061 色制限(rules/20)は engine 汎用 hand-use-card.ts colorAllowed (CardDef.colors⊆case.colors) 処理=descriptor 非記載が全 event と同一規約で正と確認。
- **ゲート全 green**: tsc0(両) / vitest 2845→2868(+23) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約 lint 8本 errors=0。

### 学び㊽
- scoping (grounding workflow) の DSL sketch は **exemplar 誤認・rules 誤適用を含む** (certify/exemplar照合が必須の理由): ① B06029 を「optional{chain}」と誤citation (実は bare chain、max:1 で「してもよい」表現) → B06016 a2/B03094 で訂正 ② B01044 の【パートナー白】を「装飾的」と誤判断 (rules/17 = 実条件、character は自身でなくプレイヤーのパートナー札の色を参照) → condition partnerColor白 を全 mill カードに付与。
- **mill の gate は既存 atom への opt-in flag が最小 additive**: 新 verb 不要 (verb名不変=3点同期不要)、args=unknown 型ゆえ TargetQuery 拡張すら不要。「死 atom 有効化」でなく「既存挙動を壊さず新分岐追加」。最も収束的な engine 拡張パターン。
