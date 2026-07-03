# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-07-03-cardphase.md](sessions/2026-07-03-cardphase.md)。
> 再開手順: Track A = `.claude/NEXT-SESSION-PROMPT.md` / Track B = `.claude/NEXT-SESSION-PROMPT-TRACK-B.md`。

## 2026-07-03 CARD PHASE #2 — B06006 江戸川コナン 出荷 (engine変更0)

- **出荷**: B06006 江戸川コナン (青/Lv5/AP4000/LP1、探偵|毛利探偵事務所|少年探偵団)、origin **63000bc6** (FF push、race なし)。
- **3句** 全 primitive 出荷済 = engine変更0 (dormant-exemplar 解禁、DEFERRED-INDEX 709 出荷済マーク):
  - a1 `【解決編】突撃` = continuous `condition{caseStatus:解決編}` + `continuousModifier{grantKeywords:()=>['突撃']}` (D08021 a2 と condition 差替のみ)
  - a2 `【自分ターン中】重ね1枚AP+1000` = `apDelta{dyn:'$self.stackedCount * 1000'}` + `condition{turn:self}` (B05030 apDelta-dyn 同型)
  - a3 `【登場時】mill1 → リムーブの[探偵]/[少年探偵団]2枚まで下に重ね` = `chain[ mill{n:1,gate:false}, charStackCard pick{area:remove, filter:{kind:character, trait:['探偵','少年探偵団']}, n:0-2} ]` (D08021 a1 の trait 配列化 + 先頭 mill)
- **第2gate 実測** (green 鵜呑みせず全 primitive を engine コード直参照): trait 配列 any-match = candidates.ts:345 `wants.some(w=>traits.includes(w))` / caseStatus = eval.ts:113 switch + CONDITION_KIND_MAP / mill gate = core.ts:219 (`gate===true && deck<n` skip、必須は gate:false) / stackedCount dyn = dyn/eval.ts:393。
- **probe test 10件** (tests/cards/ct-p06/B06006.test.ts): shape 4 + 実機 6 (a2 AP スケール 6000/4000/opp-turn非加算/setCards非計上, a1 突撃 は解決編のみ)。engine 実評価を裏取り。
- **ゲート**: tsc0 / vitest 442files 3775+10probe pass / smoke:1000 winsA=498 不変・exceptions0 (engine変更0 証跡) / 8 CI lint errors=0。CI push 済 (run 28638331871、要 green 確認)。

## 2026-07-03 engine wave-18 — inContact 出荷 (A1 structural、parked 継続を verify→ship)

- 前 session が /c/tmp/wave18-incontact に **未commit で parked** した inContact primitive + B04075/B04092 を検証して出荷。
  memory [[reference-incontact-vein-a1-blocked]] は当時 parked 記録 (この wave が A1 gap を解消)。origin/main **6b6437b1**。
- **engine (全 additive、既存挙動不変)**: ① `inContact?` TargetQuery 軸 (parked 463730af land、candidates.matchesQueryForChar が ctx.contact.{byUid,targetUid,guardUid} で限定) ② contact emit enrichment (`buildContactBindings`: disguise:into に player+bindings.contact / contact:start source に bindings.contact) ③ triggered.ts `resolveCtx.bindings = source.bindings ?? {}` ④ `__pendingEffectOptionalBindings` holder (optional 内 inContact pick 用、BUG-114 choice の対称、queue 6th arg のみ・ctx.bindings は fresh {} で aliasing 回避)。
- **exemplar**: B04075 白鳥 (【ターン1】相手cutin/変装→コンタクト中1枚AP-1000、multi-hook cutin:used+disguise:into + triggerPlayerIs opp) / B04092 キャンティ (自他contact:start→optional self-sleep→コンタクト中1枚AP+2000、payloadKey aUid/bUid or + excludeSource + optional{chain})。
- **★T3 実機検証** (playwright MCP、:5176): 任意効果 modal に B04092 文言 verbatim→する→self-3 sleep→inContact pick が **participant2枚 (self-2/opp-2) のみ・decoy self-1 除外**→AP+2000。console err 0 (favicon 404 のみ)。binding-carrying optional の human-path (resolve-picks/pending-state/apply-pick 改) を実踏。
- **BUG-167 起票** (低、pre-existing): sceneSetState($self,sleep) が stun 状態で no-op でも chainStepNoApply 未立て→「そうした場合」後続誤適用。shipped B07019 と同挙動、非 regression。engine fix は defer。
- **ゲート**: tsc0 / vitest 3798 pass+1skip / smoke winsA=498 不変・exceptions0 / 8 lint errors=0 / docs:check 0/101。rebase (main の B06006 wave 取込、_reuse/index.ts union 解決) 後 全ゲート再走。
- ⚠ **main divergence 注意**: local `main` ref が古い e140aa8c で stale (Jul2)。真の origin = `git ls-remote` で確認必須 (`origin/main..main` は tracking ref stale で誤判定)。FF push は `git ls-remote` 実測→rebase→`push origin <sha>:main`。
- **★教訓 (B03033 latent gap 実踏)**: smoke report は gitignored だが `docs:structure` が `.claude/reports/smoke-*` を拾って structure.md に +2行 (762→764)。**docs regen 前に今回生成の smoke json/md を rm** して 762 維持 → clean checkout と一致。gen-structure EXCLUDE_DIRS 未収録の gap は別 commit 案件。
- **card-authoring vein 生存**: 手順 = 第2gate (未登録 + engine token 出荷 grep) → D08021/B05030 型 clone → probe → 6ゲート → FF。

## 2026-07-03 CARD PHASE dormant 全棚卸し (subagent triage) → 次 batch 決定

- **135 未登録 dormant を triage** (opus subagent、driver 保存 = [specs/card-phase-dormant-inventory-2026-07-03.md](specs/card-phase-dormant-inventory-2026-07-03.md)):
  **15 UNLOCKED (10クラスタ) / 120 BLOCKED**、yield ~11% (A2 well 枯渇・engine-first 完了と整合)。
- **UNLOCKED batchable = 5ペア**: cutin:used(B09086/B04090、**exemplar B03118 有=唯一の真clone**) / misread(B05015/B09016) / grantTraits(B05012/B07053) / handUseRestrict(B05120/B06109、UI重) / G17 bound-any-match(PR132/D06013)。単発5 = B06068/B02018/B03104/B01077/B09089 (⚠B09089/B03104/B01077 は local TSV effect 空=公式text 再fetch)。
- **★現実**: 10クラスタ中 exemplar 有りは cutin:used のみ。残は全 **first-consumer** → grounding + human-path playwright probe 必須。「clone で楽」は cutin:used だけ。batch 効率 = engine-token検証共有 + smoke/lint 末尾集約に留まる。
- **near-unlocked 別枠5** (engine変更0 可能性・要verify): B06026/B02062/B05087/B05088/B06043。
- **決定 (user X)**: **次セッション = cutin:used ペア (B09086+B04090) から開始** (最安全)。安全順 = cutin→misread→grantTraits→G17→handUseRestrict→単発。NEXT-SESSION-PROMPT banner に反映済。

## 2026-07-03 CARD PHASE #3 出荷 — cutin:used ペア B09086/B04090 (engine変更0)

- **出荷**: B09086 諸伏高明 (黄/Lv5/AP5000/LP1、警察|長野県警) + B04090 ライ (黒/Lv8/AP8000/LP2、黒ずくめの組織)。
  本 session で fresh author (着手時 git clean・`git grep B09086 src/cards`=空)。⚠ memory/changelog-entry は前 session が draft 済だったが card 実体は未存在 → 本 session で実装+検証。
- **共通 idiom** = B03118 キール (cutin:used observer + self-in-contact guard を effect `conditional{if: ctx.contact?.byUid === ctx.source.uid}` に置く。ability.condition では ctx.contact 未 populate=triggered.ts:300)。
- **B09086** = `triggerCutinMatches` 初 consumer (eval.ts:533、wave-3 で本カード向け出荷済)。matcher `and[triggerPlayerIs self, or[triggerCutinMatches{cardName:諸伏景光}, triggerCutinMatches{trait:長野県警}]]` → `charModifyAP{$contact.byUid,+2000,scope:contact}`。「か」=OR は matcher `or` (単一 filter は field AND)。
- **B04090** = a1 `partnerColorKeyword({color:黒,kw:'突撃[キャラ]'})` 共通クラス / a2 cutin:used observer → `sceneEnter{from:remove,viaEffect,filter:{color:黒,levelMax:3,kind:character},n:0-1}` (B08029 伊織無我 deployStep 同型)。
- **検証**: probe `cardphase3-cutin-observer.test.ts` 11件 (実 emit 経路 flow/contact.cutIn、名/特徴match・非match・ガード側コンタクト・非参加DECOY・revive候補levelMax honor を決定論確認)。gates: tsc0 / **vitest 3798→3809+1skip (+11 probe)** / smoke winsA=498 exc0 / 8 lint errors=0。
- **playwright**: 本 session は未実走。tier 判断 = cutin:used family exemplar **B03118 (wave16 で human-path playwright 済)** の clone + 新UI部品型なし → 2026-07-02 tier 規則「clone は決定表 diff で代替」に従い emit-path probe (production cutIn flow) で代替 (B06006/B03033 の engine変更0 ship と同方針)。revive の sceneEnter-from-remove pick UI も既出荷 (B03059/B08029/B07058)。full-game playwright は low-risk defer。

## 2026-07-03 夕 mega-wave program 開始 — W1+W2 出荷 (engine 拡張再開、ユーザー決定)

- **方針転換**: 目標=全カード実装エンジン (bespoke 尾含む、3-4 session 見積)。ワークフロー必須運用 opt-in。
- **W1 (9fa32ed6)**: additive 6 primitive (deckOwner:picked-host/charSetCard cardIds/revealHandToDeckTop/sceneToEvidence/handToFileBottom/evidenceToDeckBottom) + 9 printings (PR136/142・B08036・B05049/P・B03084/P・B05045/P MR)。probe 25。
- **W2 (aa08dfbe)**: restriction 6 primitive (selfContinuousFlag 4 token + opponentRestrict refreshEvidence/hirameki + colorIgnoreOnHandUse) + **ability:declared hook** + 3 printings (B05079・B03057/P)。probe 13。
- **★sonnet5 昇格 A/B 実測→CLAUDE.md 改定**: grounding/設計/意味等価=sonnet5、review=sonnet5+opus 混成。W2 初運用で sonnet lens が実 blocker (ability:declared が宣言効果より先に解決=公式Q&A違反) を検出→emit を effect queue 後へ移動+順序 probe で修正。
- **教訓**: spec の「既存」主張は W1/W2 計5件偽 (ability:declared hook 不在/action-evidence-deny 不在/可変数cost 不在/r56 on-set-host gate/r67 boundIsMr) → 着手前実測必須は wave 単位でも不変。partial card 禁止 → engine-only + DEFER (B05097/B03126)。
- 設計 pipeline: W3 (sonnet5、5 feasible) 済 `.tmp/_w3_specs.json`。backlog 正本 `.tmp/_engine_backlog.json`。

## 2026-07-03 夕 mega-wave W2b session (engine/mega-w2b → main 2f9d86ce)
- W2b 出荷: r27 mustBeSelectedByOppEvent (B08087) + r28 mustGuard enforce (B09040/P)。
  probe 24 / tsc0 / vitest 3847→3871 / smoke 498 exc0 / 8lint0 / playwright 4 scenario (__game seam)。
- 混成 review: sonnet lens が実 blocker (event-kind 判定→イベント印字ヒラメキ pick 誤 forced) 検出、
  ctx.triggerPayload event-use gate に修正 + 回帰 probe 2件。opus lens SHIP_WITH_NITS (nit 対応済)。
- W4 設計 workflow (sonnet5 ×6 agent 背景) 完了 → .tmp/_w4_specs.json 8/8 feasible。
- 水平展開: 「イベントの効果によって」型の制限は B09034 (event-use ban) と同線引き —
  今後の同型 primitive は event-use payload gate を最初から使う (memory reference 化済)。
- 次 session = W3 (observer hooks、.tmp/_w3_specs.json) + W4 (.tmp/_w4_specs.json)。

## 2026-07-03 夜 mega-wave W3 (同 session 続行、engine/mega-w3 → main cfe57dba)
- W3 出荷: observer hook 5 primitive + B03052/P・B02047・B05115・B09004 (5 printings)。probe 23 /
  vitest 3871→3894 / smoke 498 exc0 / 混成 review 両 SHIP_WITH_NITS 0-blocker (nit 3件即応)。
- B08078 DEFER (a1 remove-area ability-presence 計数 Condition 不在、partial 禁止)。
- ★latent: cross-side 短縮形 pick side/chooser 不整合 (targetCandidates side は source 相対 /
  buildShortFormPick は絶対 chooser を literal 代入)。相手手札リムーブの出荷実態は discardRandom のみ。
- 教訓: atom args の player/side は **ctx.source.player 相対** — probe を書く時は shipped 実態経路
  (B01077 discardRandom 型) に合わせる。optional は AI auto-skip → human dispatch 駆動が必須。
- 残 = W4 (.tmp/_w4_specs.json 8/8 feasible 設計済) → W5 → W6。

## 2026-07-03 夜 session (mega-wave W4)
- **W4 出荷 (origin/main a93897ec)**: stack/scope 8 primitive + 9 printings (B08035/B01012/B06008+P/B09048/B08006/B07096/B05041+P)。詳細 = NEXT-SESSION-PROMPT + DEFERRED-INDEX「megaw4」節 + changelog 2026-07-03-05。
- BUG-168 (canAction 変種 latent、修正済・smoke re-baseline 472) / BUG-169 (faceDownOnly 未移行 3枚、起票のみ)。
- 水平展開: B05028/B08034/B03039「裏向きで」印字 vs DSL 突合 (BUG-169) / B02033 は限定なしで現状維持が正 / 突撃[キャラ] 持ち既出荷カードの actor 列挙は BUG-168 fix で回復。
- 混成 review 初の lens 割れ → fable 裁定 (棄却 1 blocker、指示 2 件反映)。sonnet5 設計 spec 誤り 2 件を実装前検出 (セット≠重ね混同 / board-wide vs per-target)。
- 見積り更新: 残 ~24 row (W5 dyn/cost 4 + W6 structural ~15-20)。あと 2 session = W5+W6 前半 / W6 後半 で完了見込み。
