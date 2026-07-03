# feat(engine): mega-wave W6 前半 — structural 6 step (declareName 統合 / 再入イベント使用 / 疾風 waive / auto-phase lock / MR 選択追跡)

全カード実装エンジン完成計画 (mega-wave) の最終 structural wave 前半 (synthesis step1-6)。engine-only (consumer カードは step12 card-phase で一括)。

## step1 — declareName 統合 (rows 49/53/999 の 3-way storage conflict 解消)
- verb `declareName{bind}`: プレイヤー宣言の自由文字列カード名を `EffectCtx.declaredNames: Record<string,string>` へ (Candidate 汚染案は棄却)。供給 = `ctx.dyn.declaredName` (AbilityCostParams.declaredName → costParamsToDyn)。未供給 = 空文字 fallback + warn (AI/smoke 安全)。
- cond `boundNameMatchesDeclared{bindKey,declareKey}` (bound 集合 any-match、rules/19 分割名 component) / `boundIsMr{bindKey}` (read/def.isMR 委譲、B06085)。
- dyn `$declared.<key>` / `$declared.<key>.sceneNameCount` (実効 names honor、B09112)。
- UI `DeclareCardNameModal` scaffold (配線は card-phase、playwright 必須)。

## step2 — charSetTurnEffect resolveBindRef merge (rows 74/999 HARD conflict)
- `atomCharSetTurnEffect` val を resolveBindRef 経由に (リテラル素通し = 既存 68 usage 全 boolean → 回帰0)。`_shared.ts` resolveBindRef に `$dyn.*` branch。
- `names()` nameOverride **完全置換** read (rules/19「元のカード名は持っていない扱い」、PR105)。clearTurnEffects('turn') に nameOverride 追加。

## step3 — r63 useEventFromHand + eventUseSource (P18/P19)
- verb `useEventFromHand`: 効果内から手札イベントを pick→即時使用。emit 順序 = effect:declared (viaEffect:true) → hand.remove → remove.add (on-hand scope 契約)。FILE/色制限バイパス (公式Q&A)。eventUseBanned 防御再ゲート (B09034)。
- cond `eventUseSource{viaEffect}`: kind==='event-use' 明示ガード (cutin 誤検出防止)。B08026/D10005/B05042/B07026 解禁。

## step4 — 疾風 cluster (r58 + B09090/P16、3軸)
- per-char `shippuFiredCharThisTurn` TargetFilter 軸 (abilityIsShippu 同一 gate で記録、B09070 a3 一括アクティブ)。4-point sync (型/matchOneFilter/FILTER_FIELDS/TARGET_FILter_KEYS)。
- verb `setShippuWaive` + `TurnScopedFlags.shippuWaiveArmed`: 「次に登場したキャラは疾風の条件を無視できる」— handleHook enter 前処理が次登場 1 体で疾風有無問わず消費 (公式Q&A pin)、per-char `shippuWaived` → matcherCondition bypass (abilityIsShippu 限定)。
- setTurnEffect defensive init (turnEffects 欠落 fixture 顕在化対応)。

## step5 — board-scan cluster (r50 + r74)
- `ContinuousModifier.untargetableByActionAura?: TargetFilter` + `read.char.auraUntargetableByAction` + candidates() 負 filter (静的 pre-check 素通し)。ガード非対象 (Q&A B04072)。
- `noAutoActivateBySourceUid` per-target lock (`charSetTurnEffect val:'$self'`) + `read.char.noAutoActivateLocked` (bearer 生存 live 再評価、**ターン跨ぎ永続 = clearTurnEffects 非追加**、B01082)。
- `opponentRestrict` += 'stunAutoActivate' + restrictsOpponent **partner-bearer 拡張** + auto-phase step2 skip gate (stun→sleep 変換もしない、Q&A B03046)。

## step6 — r79 selectedByOwnMr (T3 dual-path)
- resolve-picks (AI walk) + apply-pick (human 継続) 両経路で source=MR の解決済み現場キャラ uid を `_mrSelectCharUids` 同梱 (BUG-158 型 両経路罠を対称実装) → resolver.ts atom dispatch 前 guard が tagSelectedByOwnMr (owner guard =「自分の MR」)。
- cond `selfSelectedByOwnMrThisTurn` (B08014) / `paMrColorCountMin` (B09047、partnerAreaMR slot printed colors)。

## 検証
probe 56 tests (RED→GREEN、AI/human 両経路・Q&A pin・回帰 pin) / tsc 両 config 0 / full vitest **4031 pass +1 skip** (baseline 3975+56、fail 0) / smoke:1000 **winsA=472 不変**・exceptions=0 / 8 lint err0 / 混成 review (sonnet5+opus)。

card-phase 解禁 (step12): B09112/B09108/B09003/B06085/PR105/B08026/D10005/B05042/B07026/B09070/B09090*/B04072/B03046/B01082(partial)/B08014。
