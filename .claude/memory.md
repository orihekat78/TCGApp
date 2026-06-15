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
