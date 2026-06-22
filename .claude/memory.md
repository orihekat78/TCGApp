# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-21-4.md = ㉚ / 2026-06-21-5.md = ㉛。)

## セッション㉝ (2026-06-21) — turn-scope levelDelta wave: 誤 DEFER の engine変更0 カード B05102 解禁

### 開始時の整合不一致 (重要)
handoff は「ceb9aa83 → main 取込み済」と記録していたが、remote main は **51d9b35b 止まり** = ㉛wave
(ceb9aa83 feature + df439660 docs) は **未 push** だった (push-to-main の per-session 認可で前セッションが
push 未完と推定)。ユーザー確認 → push (51d9b35b..df439660)、CI green。

### 方向: A (カード追加継続、ユーザー選択、handoff は非推奨)
handoff の「engine変更0 完全枯渇」に反例を発見。決定論 scan で **誤 DEFER の engine変更0 カード B05102** を発掘・出荷。

### B05102 小五郎の弟子 (黄 L1 event、P変種なし、ALL_CARDS 1371→1372) — engine変更0
DEFER note「continuous (temp) levelDelta 不在」は誤診断。「**ターン終了まで**レベル-1」= turn-scope one-shot
= 既存 `charModifyLevel{scope:'turn'}` (turnEffects['lvlMod_turn']、read/char.ts level() 4-scope 合算 +
turn end delete=BUG-119)。condition-gated continuous levelDelta (B08050「【解決編】+3」=真の gap) とは別物。
- a1 = `triggered{effect:declared,event-use}` + `condition{partnerColor,黄}` + `sequence[charModifyLevel
  {opp,max1,-1,turn}, draw{1}, sceneEnter{hand,max1,viaEffect,filter{黄,character,levelMax:{dyn:$self.fileCount}}}]`。
- exemplar: B04064(event-use+gate) / B05066(charModifyLevel opp turn) / B09038(sequence-mandatory-tail) /
  D05014(sceneEnter fileCount 黄) / PR085(hirameki self→hand)。
- **BUG-111 #2 (2026-06-16)** で sequence-origin の 0-pick decline/候補不在でも remainder (draw+enter) 実行。
  AI は charModifyLevel に chooseAtomTarget case 無 → null → chooseAiPick が cands[0] fallback (相手在=適用 /
  相手0=branch②)。両経路で draw+enter 発火 = 公式Q&A「相手1枚も選ばずとも draw 必須」と一致。
- a2 = ヒラメキ self→hand `handAddFromRemove{fromSelf:true}` (前 wave PR085)。event+hirameki は D08024 等で対応済。

### 同 scan で発見の別 gate (DEFER)
- B09078: a1 = dual-filter deck-look (1キャラ+1イベント from 1 reveal) + reveal-to-remove (engine 不在)。
- PR096: a2 = 【宣言】cost[sleep+deck-mill5] +「コストによってリムーブされた特徴[探偵]を参照」conditional (engine 不在)。

### 検証 (全 green)
tsc0 / vitest **2759pass 1skip 0fail** (2747+12新decoy) / smoke exc=0・baseline不変(avg10.998/winsA498)=engine変更0証跡 /
playwright **120pass 1skip 1fail→単体再走 3/3 pass** (spectator-speed:79 既知 timing flake、非交差) /
validate-specs PR280 fail は pre-existing (base でも同一 pass=69 fail=1)。

### 学び (恒久)
- **DEFER note は hint であって保証でない (今回は逆方向)**: 「continuous levelDelta 不在」で DEFER された
  B05102 が実は turn-scope で engine変更0。yield scan は「過去 DEFER 理由が現 engine で今も成立するか」を再評価する。
- **AI null-pick 2分岐**: chooseAtomTarget case 無の verb でも chooseAiPick は候補在なら cands[0] fallback。
  真の null は候補不在のみ → sequence-origin remainder。decoy は両端 (相手在/相手0) を踏む。

### branch / commit
branch `cards/wave-turn-leveldown-b05102`。docs同期→commit→main ff-merge→push→CI green 予定。

---

## セッション㉞ (2026-06-22) — spectator-speed flake 修正 (C 候補1)
commit `5a3a635e` (local main、push 未 / 要認可)。先行 ㉝ B05102 は main 取込み済 (6fdf136d、CI green)。

### 課題 / 根因
- spectator-speed.spec.ts:80「pause→step→resume」が時々 fail (obs 16838/16839)。
- 旧仮説「fixed waitForTimeout(500) が短い (timing flake)」は **誤り** — poll を 20s に伸ばしても fail 継続で反証。
- **真因 = 先攻の coin flip (~50%) × driver の step 粒度の非対称**:
  - self driver (useSpectatorTurnDriver) = `playTurn` で 1 ターン丸ごと → 1 step で turn 進む。
  - opp driver (useOppTurnDriver) = `stepTurn` で **1 手ずつ** (design: aiStepCounter=per-move/1ステップ) → 1 step では turn 番号進まず。
  - 先攻=opp の game で「1 step→turn 進む」を期待し fail。action log で確定 (先攻=opp は partner reasoning 1 手で stall)。

### 修正 (test のみ、engine/hook 不変=骨格凍結)
- 「turn が進むまで step を繰り返す」+ 各 step が 1 手前進 (log 追記 or turn 進行) を condition 待ち。
  speed=0 で連打 collapse 回避。先攻に依らず決定的。test 名/header の「1 step で進む」→「step で進む」。

### 検証
tsc0 / eslint0 / 同テスト単体 18 連続 pass (旧 fail 率 ~30%) / full e2e 121pass 1skip 0fail / docs:check green。

### 学び (恒久) + 残課題
- **flake 修正も systematic-debugging で根因確定**: 仮説 (timing) を反証 → 真因 (coin flip×driver 非対称) を action log で確定。
- **latent 非対称 (未修正・要判断)**: spectator の self driver=whole-turn / opp driver=per-move。design は step=per-move なので
  self も stepTurn 化が一貫するが Round 4l の意図的簡略の可能性。BUG 化せず handoff 記録のみ。直すなら
  useSpectatorTurnDriver を stepTurn + self-move-tick 化 (UI hook 変更、別タスク)。
- push 未 (要 per-session 認可)。push 後 `git ls-remote origin main` で実取込み確認。
