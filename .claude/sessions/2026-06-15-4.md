# 作業ログ — 名探偵コナンTCG プロジェクト

> 当日の詳細: session ①〜④ = [sessions/2026-06-15.md](sessions/2026-06-15.md) + [-2.md](sessions/2026-06-15-2.md)、
> ⑤cluster9 / ⑥cluster11 = [-3.md](sessions/2026-06-15-3.md)。changelog-entries 2026-06-15-01〜09 に各 Phase 記録済。

## 2026-06-15 セッション⑦ — engine拡張 wave#2 cluster12 + cluster13 (triage→2 gate 連続出荷)

ユーザー指示: triage で ready-now gate を実証選定 → **両方連続で出荷**。triage workflow (6 gate × opus per-card
certify→敵対 refute→synthesize) で nested-filter-dyn(yield7/low) と aura-grant(yield8/low) を ready-now と実証
(name-designation/multi-card-sceneEnter/partner-area/mustGuard は needs-design or 0-yield と判明)。

### cluster12 (nested-filter-dyn) ✅ 出荷 (5d33bcd0, CI green) — ALL_CARDS 1181→1196

「自分のFILEエリアの枚数以下のレベルの…キャラを登場」系イベント (`levelMax:{dyn:'$self.fileCount'}`) 解禁。
- engine: `resolve-picks.substituteAtomPick` の targetCandidates 列挙直前で pick query filter 内の {dyn} を解決
  (新 `resolveTargetFilterDyn`、frozen def clone・型非widen・dyn 不在は同一参照=no-op)。filter/filterAny 両対応 (敵対指摘の latent gap hardening)。
- 15 printings: 「小さくなった名探偵」family 13 (5色+黒) + B08060/P (reveal-until-Lv7)。
- gate: tsc0 / vitest 2205(+8) / smoke winsA498 不動 / playwright 119 / opus 3-lens 設計レビュー GO/0blocker。

### cluster13 (aura-grant) ✅ 出荷 (abaef1a2) — ALL_CARDS 1196→1207

「【自分ターン中】自分の現場の [filter] キャラを AP＋1000」型 **他キャラ buff aura** (continuous OWNER-ONLY 制約を解除)。
- engine: card-def `ContinuousModifier` += apDeltaAura/lpDeltaAura/auraFilter/auraExcludeSelf。read/char `auraDelta`
  board-scan reader (cluster5 restrictsOpponent を数値 aura へ拡張、auraFilter は matchOneFilter=有効値判定)。
  candidates `auraDeltaSafe` (再帰 guard _inAuraDelta) を ap/lp/matchOneFilter に合算 (filter-AP=combat-AP, BUG-117 原則)。
- 11 printings: D05005/D07010/D07011/B01038/B01038P/B03075/B07044 (単純aura+hirameki) + B02012(青Lv5 include-self+action draw) +
  B09009(サッカー選手 include-self+hirameki回収) + PR274/PR275(conditional case非青+宣言remove)。
- gate: tsc0 / vitest 2214(+9, §4 が filter-AP=combat-AP 実証) / smoke winsA498 不動(no-op+hot-path 性能影響なし) /
  playwright 119 / opus 3-lens 設計レビュー GO/0blocker (recursion-crash・mis-encoding を source 精査でクリア)。

### 教訓 / 次セッション候補

- **教訓**: triage の敵対 refute が「additive/low-risk」ラベルの誤りを事前検出 (multi-card-sceneEnter は switch-wiring 欠如で REFUTED、
  partner-area は ビッグジュエル 0/212 で yield 過大)。engine 変更は **実装前 certify→実装→敵対設計レビュー** の二段で encoding/再帰の罠を捕捉。
  hot-path 触る変更 (aura) は smoke baseline 不動が no-op + 性能影響なしの両証跡。
- **残 engine gate** (DEFERRED-INDEX landscape、いずれも needs-design): name-designation (宣言UI+AI policy)、
  multi-card sceneEnter (switch-wiring)、partner-area 構造 (GameState slot+UI)、mustGuard (forced GuardPickerModal)、
  auraGrant(triggered 付与) (非キーワード能力テキスト付与)、loseGame (事件解決書換 high-risk multi-gate)。
- **低 urgency engine bug**: BUG-142 (reasoning 由来 refresh 水平展開)、BUG-143 (contact-scope mod 清掃)。

## 2026-06-15 セッション⑧ — engine拡張 wave#2 cluster14 (multi-card sceneEnter) + UX指摘 + sweep予定

triage workflow (残6 needs-design gate を opus per-card certify→敵対 refute→synthesize) で全 gate を実証評価:
ready-to-design は **0**、出荷可能全 gate が needs-more-design。multi-card-sceneEnter(4枚/L/med) を最良 risk-adjusted で選定。
詳細 = `.claude/specs/engine-gate-triage-2026-06-15.md`。

### cluster14 (multi-card sceneEnter) 実装・検証完了 (commit 前)
- 「…2枚まで選び登場」型。sceneEnter に cardIds:'$pick.cardIds' 契約 + switchRemoveUids[] (現場満杯 switch) を additive 追加。
- **実装前 opus 3-lens 敵対設計レビュー** が 3 blocker 検出 (0枚 decline で FILE リムーブ drop=skipResolvesAtom / `__declined` 未処理 /
  scene-full crash=full 都度再計算+victim 存在検証) + distinctNames AI dedup 等 7 fix。全て設計に反映してから着手。
- 変更: atom-handlers/apply-pick/resolve-picks (engine 3) + useEngineDispatch/Playmat (UI 2) + 4 cards (B09010/P, PR042/PR046)。
- gate 全 green: tsc0 / vitest 2226(+12) / smoke winsA498 不動 / playwright 119 + **MCP 実機** (宣言→2枚 pick→switch→2体登場+灰原哀離場+FILE-1, err0)。

### ⚠ ユーザー指摘 UX (cluster14 commit 後に別 pass で対応)
1. **EffectPickerModal (効果対象を選択) に カード画像** — 同名カード (吉田歩美×3 等) が区別不能。画像追加で識別可能に。
2. **SceneSwitchPickerModal を 現場カード直接選択に** — text-only は不適。switch=現場カードを選ぶ操作 → 既存 scene-area pick 機構を流用
   ("この処理はどこかにあるはず" = sceneRemove pick 等のクリック選択を switch victim でも使う)。単一/複数 switch 両方が裨益。

### ⚠ ユーザー依頼 (UX 対応後): トリアージ・スイープ
未実装 ~540 base カードを全 certify (3〜4 窓) → 全 engine ゲートを列挙 → 「あと正確に N クラスタ」+ 共有プリミティブ先行で回帰最小の
ロードマップ作成。目的=ゴール地点確定 + 大型ゲートの設計順序最適化。

## 2026-06-15 セッション⑨ — UI picker Direct Manipulation 化 (engine 不変・UI 層のみ)

cluster14 MCP でユーザー指摘の「ピッカー text-only で同名カード区別不能・現場直接選択不可」を解消 (memory `feedback-ui-direct-manipulation`)。
設計 = `.claude/specs/ui-picker-direct-manipulation-2026-06-15.md`。決定論 scan で確定: EffectPickerModal に落ちる pick は
**100% scene-char・全て n.max=1**、対象 verb = sceneRemove/charModifyAP(既存) + sceneSetState/charGrantKeyword/charSetCard/
charSetTurnEffect/sceneToHand(旧 text-only)。**実装前 opus 3-lens 敵対設計レビュー** (全 GO-with-fixes、1 blocker=nMax>1 soft-lock + fix 群を v2 反映)。

- 新規 `src/ui/services/scenePick.ts` `isSceneDirectPick(pending,gameState)` を Playmat+EffectPickerModal で共有 (二重UI/soft-lock 防止)。
- Playmat: isScenePick を候補ベース述語に一般化 / switch victim を self 現場直接クリック化 (旧 SceneSwitchPickerModal 撤去・store 維持) /
  banner verb 別 + switchSessionActive flicker gate。EffectPickerModal: scene pick は null + fallback に CardArt。
- gate 全 green: tsc0 / eslint 0err / **vitest 2232** (+scenePick 8, −SSP test 2) / **smoke winsA=498 不動** /
  **MCP 実機** (sceneRemove opp rotate180 同名 decoy / sceneSetState 新verb / hand-use switch 直接 / nMax>1 fallback 画像, console err0)。
- out of scope: Guard/MisreadPicker (別フロー、follow-up 候補)。**次 = トリアージ・スイープ**。
