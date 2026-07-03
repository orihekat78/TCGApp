# 次セッション再開プロンプト — Track A1: engine 拡張 structural lane (2026-07-02 二Track化 → 2レーン化)

> ★Track B (compiler 監査) = [NEXT-SESSION-PROMPT-TRACK-B.md](NEXT-SESSION-PROMPT-TRACK-B.md) /
> ★**Track A2 (additive lane、並行 engine session)** = [NEXT-SESSION-PROMPT-TRACK-A2.md](NEXT-SESSION-PROMPT-TRACK-A2.md)。
> **2 レーン排他 rule** ([specs/engine-parallel-2lane-2026-07-02.md](specs/engine-parallel-2lane-2026-07-02.md) 必読):
> 本 lane (A1) = structural 専任 — hook 新設 / flow / resolver 構造 / GameState 形状 / UI / cost union。
> **純 additive (評価器/dyn/verb 追加/turn-flag) は A2 の管轄** — 本 lane では触らず DEFERRED-INDEX 経由で A2 へ送る。
> push は先着 FF、後発は rebase 後**全ゲート再走**。重い review workflow は A2 と同時起動しない。
> **wave 着手時に /engine-wave skill を起動** (model opus/sonnet/fable + effort 判断表。fable agent 復活実測済 2026-07-02)。
> 本 session は engine 拡張専任 (直近: E2 structural wave-8 出荷 shippuFiredThisTurn flag + 推理不可付与 canReason gate、engine-only)。

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 方針 (2026-06-30、ユーザー決定)
- **engine 拡張のみ先に全部 → 完了後にカード追加フェーズ** (engine-first)。骨格凍結到達が目標。
- 認識合意: 計画 (E1+E2+E3+MR) 完了 = 現561枚に対しエンジン拡張完了。±5/軽微touch-up/将来セットは別。

## ★★方針改定 (2026-07-02、ユーザー決定 — 速度リバランス)
- 「速度<精度 一律」撤回 → **リスク連動 3-tier ゲート** ([specs/speed-rebalance-2026-07-02.md](specs/speed-rebalance-2026-07-02.md))。
  T1 (pure-additive/clone)=機械ゲート+probe のみ・review 0-1 lens / T2=2 lens / T3 (hot-path/core/MR)=従来フル。
- wave 大型化: T1 は 10-15 prim or 20-40 card / 1 commit、1 session 複数 wave 可 (context 60% まで)。
- **全カード完了計画** = [specs/all-cards-completion-plan-2026-07-02.md](specs/all-cards-completion-plan-2026-07-02.md)
  (残535枚。**Track A** = engine A1-A5 10-12 session / **Track B** = compiler B0-B3 5-9 session、計 ~15-21・並行で暦上 ~10-13 slot)。
- engine wave には **exemplar カード 1-2 枚を同 commit 同梱** (E2E 生きたテスト + clone 原器、再certify 二度手間排除)。
- **text→DSL compiler 採用 (2026-07-02 ユーザー決定)**: silent 誤訳の源=AI 即興翻訳を whitelist 文法で構造排除。未知句 refuse→DEFER。
- **★二 Track 並行 (2026-07-02 ユーザー決定)**: 本 prompt = **Track A (engine 拡張専任)**。compiler/文法/oracle/bulk author は
  **Track B 専任** ([NEXT-SESSION-PROMPT-TRACK-B.md](NEXT-SESSION-PROMPT-TRACK-B.md) / driver [specs/compiler-track-plan-2026-07-02.md](specs/compiler-track-plan-2026-07-02.md))。
  Track A の対 B 義務 = **exemplar カード 1-2 枚を wave 同 commit 同梱のみ** (B の oracle 入力 + 新 primitive の機械可読 spec。
  production rule 登録は B へ移管、A は書かない)。A は src/engine+exemplar / B は scripts/compiler+bulk のみ。
  B の bulk は「1 wave 以上前に出荷済 primitive の family」限定 (barrel 衝突なし)。

## 現在地
- ★開始時 `git ls-remote origin main` + `gh run list -L1` で remote HEAD / CI 確認。
- **main = bf33786d** (**E3 増分4 P10 = E3 最終 → engine-first 計画 完了**。partnerSolveOverride: パートナー【事件解決】per-game 書換 + alt-lose。engine-only、opus 3-lens 全 SHIP_WITH_NITS・0 blocker。設計最小化 = UI/AI/Cost-union/keyword enum 全て不要と実証、3 file only。直前 = 4ba5957c wave17 テキーラ / 5effb6a9 wave16 キール / 8c326afb E3 増分3 P53)。vitest baseline=**3772 pass +1 skip** (bf33786d。P10 probe +11)。
- ★★★**engine-first 計画 (E1+E2+E3+MR core) 完了 = 骨格凍結到達**。A1 structural / A2 additive 両 well 枯渇。**次フェーズ = CARD PHASE** (card 凍結解除、consumer authoring)。engine 拡張は今後 ±5/軽微 touch-up のみ。
- ★★**方針更新 (2026-07-02、ユーザー)**: **カード拡張は engine 拡張完了まで凍結**。engine wave は engine-only (consumer カードは card phase)。exemplar 同梱も card 扱いゆえ当面なし (probe test で検証)。
- ★★**2026-07-03 実測: A2 additive の clean sole-unlock は完全枯渇** ([[reference-a2-additive-sole-unlock-dry]])。決定論 grep (41候補中29 SHIPPED) + 8-agent grounding workflow で **CLEAN_AUTHOR=0/8**。残 additive verb は全て真absent だが consumer に structural gate 残 (on-set-host WRITE/PA-declaration/MR-cond)→0 unlock=dead code。**「まとめて additive batch」は不可能。再sweep 不要**。残 engine = structural cluster のみ (逐次 T2/T3、並列著作不可)。
- ★★**A1 structural queue 状況**: G34「以下から1つ選んで行う。〜の場合、代わりに全部」は grounding の結果 **大半カード作業と判明** (choice atom は既存・成熟、1-of-M は動く。novelty=escalation の条件/コスト分岐のみ、condition-variant は既存 conditional/choice/sequence で authorable)。→ A1 structural の残本命 = **E3 (rule-rewrite/alt勝敗)**。分解計画 = [specs/e3-altwin-decomposition-2026-07-02.md](specs/e3-altwin-decomposition-2026-07-02.md)。
- ⚠ 並行 session 複数稼働・同一 working tree 共有 → 自分のファイルだけ明示 add。engine 並行は `git worktree add` 隔離。

## ★driver: engine 拡張 実行計画
- **[engine-extension-plan-2026-06-30.md](specs/engine-extension-plan-2026-06-30.md)** + per-primitive 全データ
  [.tsv](specs/engine-extension-plan-2026-06-30.tsv) (batch/label/member/sole/additive/effort/stale/vocab/plug/**cardTextPattern**)。
- 85 primitive grounding (opus 11agent workflow)。**50 pure-additive / 32 structural / 3 risky / 10 stale既出荷**。総 sole≈278。
- 実行順 = **E1(additive)→E2(structural)→E3(risky)→MR(G42)**。各 phase 内 impact降順。

## ⚠⚠ 最重要 process 教訓 (継続)
- grounding TSV の sole/effort/stale は **上振れ**。**各 primitive 着手前に origin/main で実 grep 必須** (vocab token を `git grep origin/main -- src/engine`)。
- **sole-count も per-card 要 certify**。card-wave 同様、wave の対象カードは個別確認。
- **TSV の pure-additive ラベルも要検証**: wave-5 で **P37 (trait/name grant aura) は TSV では pure-additive だが実際は matchOneFilter (BUG-117 hot path) の trait/color/name 読みに late-bind aura を差す=filter-core 変更**。「read.char.traits だけ足す」は半端解 (matchOneFilter 経由の filter/bond が granted trait を見ない、on-set-host session70 の READ≠解禁 教訓)。→ **P37 は wave-5 から分離し wave-6 で単独・全 lens review** に回した。

## 直近 wave 出荷済
- **wave-12 (A1、2026-07-02)** — **G39 PA 一般カード枠**: `PlayerState.partnerAreaCards?: CardId[]` +
  verb `toPartnerArea` (mutate.partner.addAreaCardFromRemove = evidence.gainCard 同型: lastIndexOf splice +
  不在 no-op B06026 + remove:exit emit) + candidates partner-area 列挙 ({kind:'card'}、consumer 0 = 挙動不変) +
  UI PartnerArea PA list。exemplar **6 printings = 移動4テキスト全数** (B07059/P 赤い涙・B07060/P クリスタル・
  マザー・PR195/196 ブルーサファイア、全 a2 ヒラメキ toPartnerArea)。**plain sequence 必須** (chain だと
  0-skip 時 PA 移動 drop = Q&A 違反、certify 敵対指摘)。traits ビッグジュエル = **公式 API category1 一次確認**
  (★G40「event traits 全空」は hand-author 経路では非 blocker — B07055 明示運用で計数側 filter 成立可)。
  certify wf 誤訳0/blocker0 → 4-lens 4/4 SHIP_WITH_NITS 0-blocker → playwright 実機 (★human 0-skip →
  toPartnerArea 発火 / apMax8000 境界+AP9000 decoy 除外 / PA render / err0)。tests +23 (F2 = BUG-166 pin 含む)。
  latent = [[BUG-166]] (解決中イベント refresh 巻き込み rules/26 乖離、B07060 deck0 で初到達、graceful) +
  DEFERRED-INDEX「wave12-pa-cards」節 4件。session log = sessions/2026-07-02-wave12.md。
- **wave-10 (8a3e4f18)** — **BUG-165 修正 (hot-path、engine+UI 2層) + 2 primitive + exemplar B07002/B07002P 江戸川コナン**:
  **BUG-165** = PB generic multi-pick collapse。n≥2 の Pattern B pick が human apply / AI drain / AI 同期 walk **全経路で先頭1枚に collapse** (apply-pick `target:[resolvedCardId]` 単数 / resolve-picks heuristic 単一)。さらに **UI (HandZone discard pick) も単発 dispatch で collapse** — playwright 実機で発見し HandZone multi-select (pickNMin/pickNMax/onPickMulti、CardListModal contract mirror + 完了ボタン) を追加。shipped 実バグ **B04005/D10012/PR137/PR143** (discard n:2 が1枚しか落ちていなかった、behavioral test 無し) を解禁。n:1 は byte 不変。handReveal ★未対応(3) 解消 (残 (1)(2)(4) は DEFERRED-INDEX)。
  **新 primitive** = `boundDistinctColorCount` cond (bound 集合内 filter一致+相互色disjoint n枚、DFS subset、G17 残) / `setCutinBan`・`setDisguiseBan` verb + `TurnScopedFlags.cutinBanned/disguiseBanned` (side-level turn flag、canCutIn/canDisguise gate、公式Q&A「離場後も有効」担保、setNextHintBan template)。
  **exemplar B07002** = a1 draw2→discard2(bind $discarded)→conditional(boundDistinctColorCount{trait:探偵,n:2})→sceneRemove apMax8000 (D02002 VERBATIM 節、conditional.then 内 PA 短縮形 = BUG-145 裁定通り安全) / a2 cost sleepChar(探偵、self包含・excludeSelf 無し、head-fixed は engine-wide 既知)→両 ban (opp)。
  ★★教訓: **「N枚 pick」atom は engine 3経路 probe + playwright 実機 UI の4層で踏む** — engine probe green でも UI 層が pickedUids を集めない collapse があった ([[reference-engine-wave10-multipick-cutinban]])。catalog-reuse バッチは descriptor test のみで behavioral 空洞がありうる。opus 4-lens 全 SHIP_WITH_NITS 0-blocker (nits は DEFERRED-INDEX「wave10-b07002」節に latent 記録: 無色 disjoint / conditionIfIsStable $-prefix 規約 / AI greedy 非最適 / HandZone multi は discard のみ配線)。gates: vitest 3642+1skip / smoke winsA=498 不変 exceptions=0 / playwright E2E console err0。changelog [2026-07-02-06](changelog-entries/2026-07-02-06-engine-wave10-b07002-multipick.md) / [[BUG-165]]。
- **wave-9 (985732f0)** — card **B09072 横溝重悟** (+ parallels B09072P/B09072P2) 出荷、**engine変更0**。wave-8 `shippuFiredThisTurn` flag / `cannotReason` gate の **初 live consumer** (E2E 検証兼) + carrier-reuse。
  a1=【登場時】conditional(flag shippuFiredThisTurn)→[mill n:2, draw 1] / a2=【宣言】cost[sleepSelf,removeFromHand]→carrier-reuse `sequence[sceneSetState carrier{player:self,max:1,**side:either**,filter{trait:神奈川県警},state:active,bind:$picked}, charSetTurnEffect rider{$picked.uid,cannotReason}]` / a3=【ヒラメキ】draw (D01003 byte等価)。
  ★★教訓: wave-8 DEFER「sceneSetState/charSetTurnEffect は bind 非対応」は **false-DEFER**。実機 probe (AI/human/decline 3経路) で carrier-reuse 成立を確認し訂正出荷。**sceneSetState は carrier 可** (短縮形に `player` 必須) / **charSetTurnEffect は rider 可** (resolveBindRef) / bind 書込は verb 非依存。resolveEffectPicks 初期 walk は **PB のみ** surface・PA は runtime paShortFormAwait 解決 → 「PA carrier は resolveEffectPicks で見えない=carrier 不可」は誤結論。[[reference-scenesetstate-charsetturneffect-carrier-reuse]] / DEFER 否定は code-reasoning でなく実機 probe で ([[feedback-carrier-reuse-human-path-empirical]])。
  ★grounding: unscoped「〚特徴［X］〛のキャラを選び」(「自分の」修飾無し) = **side:'either'** (rules/15、B05096/B03017/B06067 precedent、敵対 review NIT 反映)。opus 4-lens 全 SHIP_WITH_NITS 0-blocker。changelog [2026-07-02-04](changelog-entries/2026-07-02-04-card-b09072-shippu-consumer.md)。
- **wave-8 (8ef34c0d)** — E2 structural P15 (Condition 消費部) + 推理不可付与、**engine-only** (consumer B09072 は wave-9 で出荷済):
  `TurnScopedFlags.shippuFiredThisTurn?: boolean` = 「このターン中 自分のキャラの【疾風】が発動していた場合」(B09072 a1)。
  記録=[triggered.ts handleHook](../src/engine/listeners/triggered.ts) が `abilityIsShippu` (enter+enterOrderEquals、【登場時】と区別)
  全 gate 通過=**発動時点** (rules/24) で `card.player` 側へ。消費=**汎用 Condition `{kind:'flag', key:'shippuFiredThisTurn'}`**
  (新 Condition kind 不要、`flag.key: keyof TurnScopedFlags`)。清掃=endTurn 両者 primary + resetTurnFlags backstop (cross-turn stale 閉鎖)。
  per-side boolean=**departed-safe** (離場後も履歴残る)。+ **推理不可付与** = [canReason](../src/engine/flow/main/reasoning.ts) に `cannotReason`
  turnEffect gate (active-check 後・名乗り/迅速前=絶対制限 rules/11、既存 charSetTurnEffect 流用、clearTurnEffects('turn') 清掃)。
  ★grounding 教訓: **P05-P09 カットイン抑止は stale-shipped** (wave-0629d `cutinBanOpp_action`、TSV 提案名 `cutinSuppress` で name-grep 誤検出)
  → **semantic (機構) grep 必須**。opus 4-lens 全 SHIP・0 blocker。gates: vitest 3589→3602 +1skip (新13) / smoke winsA=498 0-exc (write-only-inert+gate-inert=挙動不変)。
  詳細 [[reference-engine-additive-wave8-shippu-fired]] / changelog [2026-07-02-03](changelog-entries/2026-07-02-03-engine-additive-wave8-shippu-fired-reasonban.md) / DEFERRED-INDEX「wave8-shippu-fired-reasonban」節。
  **DEFER**: B09072 card (a2「1枚選び active化+推理不可」= pick-bind carrier 不在、sceneSetState/charSetTurnEffect bind 非対応) / P15 TargetFilter 軸 (B09070 非sole)。
- **wave-7 (ef63cd9b)** — E2 structural **起点** P17 (actedCharThisTurn char filter) + exemplar **B08049 ジョディ** 同梱 (新方針の生きた E2E):
  `actedCharThisTurn?: boolean` TargetFilter 軸 = 「このターン中にアクション[キャラ]した」board char。**記録**=[state-machine.declare](../src/engine/flow/action/state-machine.ts) が `action:declare` emit 後 `target.kind==='char'` の時 actor へ `setTurnEffect`(アクション[事件] は除外、rules/22 宣言時確定)。**参照**=[matchOneFilter](../src/engine/target/candidates.ts) が board char の turnEffects flag を honor (**全 filter-eval site が委譲**→単一挿入で全 site honor、c=null fail-closed、hasSetCards と同 `!== undefined` symmetric)。**清掃**=[clearTurnEffects('turn')](../src/engine/mutate/char.ts)('action'/'contact' は残す)。**3-way sync**(型/FILTER_FIELDS/TARGET_FILTER_KEYS)+ pre-existing `colorNot` 漏れ修正。exemplar B08049: a1=ターン終了 FBI≥4 draw / a2=宣言 sleepSelf→今ターン acted FBI を active化。
  ★sceneSetState PA 短縮形の宣言 dispatch は `resolveEffectPicks` 不可 (bespoke await-path)→ test は production `candidates()` + `cost.canPay` で検証。opus 4-lens 全 SHIP・0 blocker。詳細 [[reference-engine-additive-wave7-acted-this-turn]] / changelog [2026-07-02-02](changelog-entries/2026-07-02-02-engine-additive-wave7-acted-this-turn.md) / DEFERRED-INDEX「wave7-acted-this-turn」節。
- **wave-6 (9f9ea043)** — 純 additive 1件 (P37 継続 trait/name grant、**単独隔離 + opus 4-lens** 済):
  `grantTraits` / `grantNames` ContinuousModifier field ([card-def.ts](../src/engine/types/card-def.ts))。self-scope 継続
  「現場にいるこのキャラは〚特徴/カード名[X]〛を持つ/としても扱う」。[read/char.ts](../src/engine/read/char.ts) `grantWalk`
  (自身 continuous ability を condition + inPA gate 走査、grantKeywords 対称) → `traits()`/`names()` が **印字∪granted** を返す。
  [candidates.ts](../src/engine/target/candidates.ts) `traitNameGrantSafe` late-bind + `_inTraitNameGrant` 再帰 guard
  (continuousDeltaSafe 同 posture、depth-2 終端)。**matchOneFilter trait/cardName/cardNameNot** + read.char.traits/names +
  **cond/eval bond** の 5 honor site が **board char (c?.uid 既知) のみ** effective 集合を honor。c===null (hand/deck/remove/
  bound=cardId) は印字のまま (公式 Q&A「現場にいなければ有効でない」B07053/B08063)。`effectiveNameComponents` export で bond と
  matchOneFilter が同一 name 解決 (BUG-117 一貫性)。→ 解禁 (card-wave): **B05012 恩田遼平 / B07053 ロボット黒羽快斗 /
  B08063 黒田兵衛** (self trait/name、B08063 は自己計数)。★grounding で sole=7 は clean 3 枚に収束。
  **DEFER**: B06095 (全8エリア turn aura=別機構) / B05101 (permanent applied trait 変更+変装引継=mutate verb 要、removeTraits 未追加)。
  opus 4-lens=semantic/edge SHIP_WITH_NITS + additivity/dsl SHIP (**0 blocker**、NIT は opp-side/co-grant/stacking テスト追加で対処)。
  詳細 changelog [2026-07-01-03](changelog-entries/2026-07-01-03-engine-additive-wave6-trait-name-grant.md) /
  DEFERRED-INDEX「wave engine/p37-trait-name-aura」節 (latent 4件記録) / [[reference-engine-additive-wave6-p37-trait-name]]。
- **wave-5 (7d1e0be2)** — 純 additive 2件:
  `boundAnyMatchesFilter` cond(G17、[cond/eval.ts](../src/engine/cond/eval.ts))=ctx.bindings[bindKey] **全枚数 any-match**。
  既存 boundMatchesFilter は bound[0] のみ→N>1 の公開/リムーブ集合を評価不可だった。各要素を matchOneFilter(c=null=CardDef 印字値、
  remove-area cand は removeColorAtLeast L291 同流儀) に委譲。PR132「特徴[警察]がリムーブされた場合」(any) / D06013「【緑】と【白】が1枚以上」
  = and[boundAny{緑},boundAny{白}] で合成。CONDITION_KIND_MAP + cjs CONDS 両登録。 /
  `handUseRestrictFilter` ContinuousModifier field(P05、[card-def.ts](../src/engine/types/card-def.ts))=case card 継続能力
  「自分は〚特徴[X]〛以外のキャラを手札から使用できない」(B05120 探偵/B06109 高校生)。新 helper `handUseCharRestrictAllows`
  ([hand-use-card.ts](../src/engine/flow/main/hand-use-card.ts)) が自 case def の abilities[].continuousModifier.handUseRestrictFilter を
  走査(**type==='continuous' + ability.condition honor**、read/char.ts 同流儀)、**手札の使用 + ネクストヒント両経路**で character-only gate。
  event/効果登場/カットイン/変装/ヒラメキ は別経路ゆえ対象外(公式 Q&A)。★opus 4-lens=**SHIP_WITH_NITS(0 blocker)**。
  NIT対応済=type/condition guard 追加。DEFER=B07002 distinct-color-pair(別 Condition 要) / B06103 カード名+効果登場ban(別 mechanism) /
  UI toCandidate next-hint 候補除外(consumer カード出荷時=card-wave 配線、現状 engine gate+runNextHint throw で server-side enforce 済)。
  詳細 changelog [2026-07-01-02](changelog-entries/2026-07-01-02-engine-additive-wave5.md) / DEFERRED-INDEX「wave engine/wave5-bound-handrestrict」節。
- **wave-4 (8d76aeb3)** — `$self.level` dyn / `drawUpToHandSize` verb / `remove:exit` observer+`removeExitMatches`。詳細 [[reference-engine-additive-wave4-0701]]。
- **wave-3 (80621194)** — 観測 hook `cutin:used`/`misread:performed`/`evidence:removed` + `triggerCutinMatches`。詳細 [[reference-engine-additive-wave3-observer]]。
- **wave-2 (3c0bc702)** — 評価器 `evidenceDiff`/`sceneCountCompare`/`removeColorAtLeast.cardKind`/`$self.sceneColorNot` dyn。詳細 [[reference-engine-additive-wave-0630]]。
- **wave-1 (8f715c92)** — `setNextHintBan`/`nextHintBanned` (turn-flag テンプレ)。

## 次やること: ★CARD PHASE (engine-first 完了 → card 凍結解除)

- ★★**engine 拡張 (E1+E2+E3+MR core) 全完了**。A1 structural / A2 additive 両 well 枯渇 (2026-07-03)。
  以後 engine は「骨格凍結」= ±5/軽微 touch-up/将来セットのみ。**メイン作業 = カード追加 (consumer authoring)**。
- **card phase = /card-wave skill 起動**。engine 解禁済み consumer を DSL authoring (engine 変更0、card-addition-checklist 通す)。
  即着手可能 vein (engine-unlocked, authoring 待ち):
  - **E3 consumer**: B03135/B05118/B06105 (partnerSolveOverride case、黒 gate= condition partnerColor) / B09107 (P53 cannotSolveCase+evidenceFlip all+evidenceTraitAtLeast)。⚠ B06105 は加えて【宣言】evidenceFlip pick-3 効果。⚠ authoring 時 `opponentLoses` の args.player=**勝者=self**。
  - **card-authoring vein** (memory [[reference-card-authoring-stale-defer-vein]] / [[project-engine0-queue-dry-stale-defer-vein]]): DEFERRED-INDEX の engine 名指し・未登録 exemplar (dormant) を第2gate 検査して解禁。contact-participant vein (B04037 系) も live。
  - **PA 宣言19+発動5** (MR partner-area、memory [[project-mr-partner-area-design-2026-06-23]])。
- ⚠ card phase 着手前: `git grep '<ID>' src/cards` で登録確認 (spec の「解禁/即出荷可」は stale 化しうる、memory [[reference-unlocked-label-stale-grep-srccards]])。全句 engine 実測 (probe) で第2gate 再certify ([[reference-engine-unlocked-second-gate]])。
- **Track B (compiler)** は別 lane 継続 ([NEXT-SESSION-PROMPT-TRACK-B.md](NEXT-SESSION-PROMPT-TRACK-B.md))。bulk card authoring は B の compiler 経由も選択肢。

### 参考: 残 engine (万一の ±5 touch-up、原則やらない)
- P48 じゃんけん RNG (B07011、pure-additive) — 需要低・単発。card phase で consumer 出た時のみ。
- PR263 count-dyn (PA jewel 計数 ×N aura) — 単発 dyn、card 出荷時に。

### 参考: 旧 A1 候補 (E3 完了後 or card phase 送り)
- **G34 escalation** (B05023/B05062 = condition-variant は card authorable / B07013/B09067 = cost-variant は
  「optional-cost→escalate」narrow idiom が要検討)。**card 凍結解除後に card phase で** author。
- **G39 PA 計数・消費 = 出荷済 (main f0752154)**。wave A1「PA 計数・消費」: 

### 参考: 旧 A1 候補 (E3 完了後 or card phase 送り)
- **G34 escalation** (B05023/B05062 = condition-variant は card authorable / B07013/B09067 = cost-variant は
  「optional-cost→escalate」narrow idiom が要検討)。**card 凍結解除後に card phase で** author。
- **G39 PA 計数・消費 = 出荷済 (main f0752154)**。wave A1「PA 計数・消費」:
  新 verb `partnerAreaRemove` (PA 一般カード枠から filter 一致 N 枚 pick→remove、atomHandReveal clone +
  exact-N gate) + PA-read = engine0 (既存 sceneHas が candidates area:'partner-area' 経由で PA 列挙) +
  UI 配線 (CardListKind 'partner-area'、Playmat auto-open が CardListModal multi-pick で開く、charStackCard 同経路)。
  exemplar B07037 黒羽快斗 (optional{chain[partnerAreaRemove n:2, sceneEnter revive]}) / B07045 セリザベス女王
  (engine0 PA-read + turn-end self-active)。opus 2-lens 敵対 review 両 CLEAN・0 blocker。詳細 [[reference-engine-wave-a1-pa-consume]]。
  ⚠ **B07037 human 2-pick の live playwright は未実施** (card が deck-builder で選択可能になった時に1回踏む、wave-10 B07002 同様)。
  ★DEFER: **PR263 怪盗キッド** (PA jewel 計数 AP+1000 aura = count-dyn ×1000 別 primitive + PA→remove n:1 + remove-target)。
  DEFERRED-INDEX「wave-a1-pa-consume」節参照。
- **次候補** (影響降順、★per-card sole 要 certify、着手前 origin/main semantic grep):
  - **G34「以下からKつ選んで行う」N-of-M multi-select choice (demand-signal #4、4枚)**: B05023/B05062/B07013/B09067。
    choice atom は現状1択のみ — resolver/UI 両面 = **T3**。
  - **勝敗系 rewrite (P10/E3、demand-signal #1、8枚)**: 【事件解決】書き換え+代替勝利【証拠隠滅】。E3 risky = 計画順で最後。
  - **PR263 count-dyn** (上記 DEFER、PA jewel 計数 aura。sceneMaxLp 系 dyn の延長だが ×N 倍率が novel = A2 寄りの純 additive、A2 lane 候補)。
  - P16 疾風条件 override (B09090、複数 primitive 同 wave のみ) / P15 TargetFilter 軸 (B09070 非sole)。
- ✅ 「アクション中のキャラ」= **wave-11 出荷済 (main e7512f8f、CI green)**。実装 = `$trigger.byUid`
  (アクション[事件] actor を evidence:remove-by-action payload で貫通) + consumer B03085/B03085P/B05032/B05111。
  ※ isActingChar TargetFilter 軸ではなく payload 直参照 (候補=actor singleton)。DEFER: B08006 (a1【宣言】下に重ね が別 primitive)。
  vitest baseline は e7512f8f で **3695 pass +1 skip** (wave-11 分 +7、wave-13 分 +7 込み)。詳細 [[reference-engine-wave11-hirameki-actor]]。

## 旧 wave-11 候補メモ (参考、着手前に必ず origin/main semantic grep)
- ★着手前: `git ls-remote origin main` で HEAD 確認 → 各 primitive を origin/main (**8a3e4f18** 以降) で **semantic (機構) grep** (stale 排除)。DEFER 否定は実機 probe で反証 (wave-9 教訓)。「N枚 pick」を含む場合は **4層検証** (engine 3経路 + playwright UI、wave-10 教訓)。
  **wave-7 P17 / wave-8 P15 Condition部 / wave-9 B09072 / wave-10 G17+turn-ban+BUG-165+B07002 出荷済**。
- **wave-11 候補** (影響降順、★per-card sole 要 certify):
  - **G39 PA 移動 + PA〚ビッグジュエル〛計数 aura (demand-signal #2、4+3枚)**: 非MR カードの PA 移動 verb (toPartnerArea は dead stub = 未実装) + PA slot 計数。B07059/B07060/PR195/PR196 (+計数3)。mr-partner-area core (bef3adad+5352c470) の slot 流用可能性を先に実測。
  - **「アクション中のキャラ」TargetFilter 軸 (demand-signal #3、4枚)**: B03085/B05032/B05111/B08006 (【ヒラメキ】【解決編】K枚スタン)。stun verb (sceneSetState) は有、filter 軸のみ novel。actedCharThisTurn (wave-7) と同型の挿入面。
  - **「以下からKつ選んで行う」N-of-M multi-select choice (G34、demand-signal #4、4枚)**: B05023/B05062/B07013/B09067。choice atom は 1択のみ — resolver/UI 両面 = T3 想定。
  - **P16 疾風条件 override (B09090)**: 単独 exemplar 不可 (case-triggered discard + keyword-presence cost filter 併存) — 複数 primitive 同 wave でのみ。
  - **P15 TargetFilter 軸 (B09070)**: 非sole (removeArea-filtered-select/PA-declared 併存)。
  - **勝敗系 rewrite (P10/E3、demand-signal #1、8枚)**: 【事件解決】書き換え+代替勝利【証拠隠滅】。E3 risky = 計画順で最後 (E1→E2→E3)。
- genuine-absent E1 残: B04074 ($revealed-level-any=G17 複合) / B08043 (sceneMaxLp dyn) は別 primitive / S-tail (TSV)。
- ⚠ wave-10 latent (card-wave 時): B04005/D10012/PR137/PR143 は BUG-165 fix で human/AI とも 2枚 discard になった (挙動変化=正しい方向、behavioral test は bug-165 test が B04005 を cover)。B07002 a2 のコンタクト実機通し (相手 cutin 候補が出ないこと) は human 実戦投入時に 1回踏む。HandZone multi-select は discard verb のみ配線 — nMax>1 の他 hand-pick verb 出荷時に Playmat 配線追加。

## プロセス共通 (実証済)
- engine 並行 worktree: `git worktree add -b engine/<name> /c/tmp/<dir> origin/main` → PowerShell `New-Item -ItemType Junction`
  で node_modules を main から junction → 作業 → FF push → worktree remove。
- TDD: RED(専用 test、feature-missing fail) → GREEN(最小配線) → 実カード使用形は drain/produce 経路で検証。
  turn-flag 系は `tests/cards/cluster6-event-use-ban-behavioral.test.ts`、条件評価器/dyn は `engine-additive-wave-0630.test.ts`、
  gate 系は wave5 の `engine-additive-wave5.test.ts` が template。⚠ runNextHint は `produce(draft)` 内駆動 (popTop が Immer current() 使用)。
- **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge-test)。⚠ **worktree 絶対パス明示 + `git -C` 裏取り強制 + 埋め込み diff**
  (reviewer は default で main cwd を grep し「未実装」誤 block ([[feedback-workflow-review-reads-cwd-not-worktree]]))。SHIP_WITH_NITS の NIT は card-wave に持ち越すか即対応か判断。
- 6ゲート: tsc0(両 tsconfig) / vitest(baseline=HEAD件数、現3602pass+1skip、`--exclude _probe_`) / smoke:1000 winsA=498 不変 / 8lint err0。eslint=CI非対象。
  engine-only primitive は card consumer 無 → playwright N/A。
- cond 追加は **CONDITION_KIND_MAP + scripts/taskA-validate-specs.cjs CONDS 両登録必須**(satisfies Record で tsc 強制)。
- **commit**: 自ファイル明示 pathspec + `--no-verify` (pre-commit docs:check は CI除外)。changelog-entry 手書き (`.claude/changelog-entries/<date>-NN-slug.md`)。
- **FF push**: `git fetch origin` → `git rebase origin/main` → `git push origin HEAD:main` → `gh run list -L1` CI green。
- カード全文 helper `.tmp/_fulltext.cjs <ids>`。grounding 中間データ: `.tmp/_grounded.json`(85prim) / `.tmp/_label_to_ids.json` / `.tmp/_consolidated_primitives.json`(P01-55) / `.tmp/_engine_ref.md`(G## taxonomy)。
- Read hook が line1 truncate → Edit は Read 1回で登録 / 全文は Bash cat/sed。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。

## アーカイブ
- 上限調査 [engine-extension-upper-bound-2026-06-29.md](specs/engine-extension-upper-bound-2026-06-29.md) / DEFER [DEFERRED-INDEX.md](specs/DEFERRED-INDEX.md) / bug index.base / memory MEMORY.md。
- 旧 wave (handReveal/setCardCount/certify wave 等) は git log + .claude/sessions/ 参照。
```
