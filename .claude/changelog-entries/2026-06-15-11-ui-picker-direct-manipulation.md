# UI picker Direct Manipulation 化 — scene-char pick / switch victim を現場カード直接クリックに

**Round/Phase**: 2026-06-15 UI 改修 (`ui/picker-direct-manipulation`)。cluster14 MCP 実機でユーザーが指摘した
「ピッカーが text-only で同名カード (吉田歩美×3) が区別不能・現場カードを直接選べない」を解消。
原則 = memory `feedback-ui-direct-manipulation` (Recognition over Recall / Direct Manipulation)。
**engine 不変・UI 層のみ** (骨格凍結原則に抵触なし)。実装前に **opus 3-lens 敵対設計レビュー** を通し
1 blocker (nMax>1 scene pick の soft-lock) + 主要 fix を設計 v2 に織り込んでから着手。

### 確定スコープ (決定論 scan: 全1211カード)

pick area = scene 150 / remove 22 / hand 18。**EffectPickerModal に落ちる pick は 100% scene-char**
(非scene/mixed は 0 件)、**全て n.max=1**。直接化対象 verb = sceneRemove/charModifyAP (既存 direct) +
**sceneSetState(78)/charGrantKeyword(19)/charSetCard(5)/charSetTurnEffect(4)/sceneToHand(3)** (旧 text-only)。

### 変更 (UI 層のみ、touched: 新規2 + 改修3 + 削除3)

- **新規 `src/ui/services/scenePick.ts`** `isSceneDirectPick(pending,gameState)`: `player==='self' && nMax===1 &&
  全 candidate.uid ∈ (self∪opp scene uid)` の純関数。Playmat と EffectPickerModal が **共有** (二重UI/soft-lock 防止)。
- **Playmat.tsx**: `isScenePick` を verb 白名簿 → `isSceneDirectPick` に一般化 (7 verb + 将来 verb を自動被覆、both-scene 既対応)。
  skip-overlay の banner を **verb 別** (`sceneVerbBanner`、画面処理=カードテキスト文言)・skip ボタンを中立『選ばない』に。
  switch victim を旧 modal から **self 現場直接クリック** に (`switchActive`/`handleSwitchVictim`/`switch-victim-overlay` +
  キャンセル辞退、MUX で effect-pick と排他)。sceneEnter overflow の switch 中は `switchSessionActive` で area modal を
  閉じ・auto-open 抑止 (flicker gate)。`PlaymatSceneSwitchPickerModal` wrapper 撤去。
- **EffectPickerModal.tsx**: `isSceneDirectPick` true で `return null` (Playmat が直接処理)。残置 fallback (nMax>1/非scene、
  現状0件・将来用) の各候補に **`<CardArt>` サムネ** 追加 (同名識別)。
- **useSceneSwitchPickerStore.ts**: `SceneSwitchCharView` 型を component から移設 (store 維持)。
- **削除**: `SceneSwitchPickerModal.tsx` + `.css` + `tests/ui/components/SceneSwitchPickerModal.test.tsx` (直接化で不要)。

### gate (全 green)

- tsc 0 / eslint 0 error (8 warning は全て pre-existing)。
- **vitest 2232 pass** (2226 − SSP component test 2 + scenePick.test.ts 8: 述語の self/opp/nMax>1/非scene/mixed/opp player/0件/null)。
- **smoke winsA=498 不動** (avg 11.00、cluster14 と同値) = engine 非介入の証跡。
- **MCP 実機検証** (console err 0、favicon 404 のみ baseline):
  - sceneRemove (蘭の一撃) + opp 現場3×吉田歩美 decoy → modal 非表示・opp 現場 (rotate180) 黄枠直接クリック・
    特定 decoy (opp-2) のみリムーブ・banner「リムーブ」。
  - sceneSetState (新 verb) + self 3×吉田歩美 → modal 非表示・self 黄枠+画像・banner「状態を変更」。
  - hand-use switch (現場満杯) → switch-victim-overlay「吉田歩美 — 退場キャラを…」+ キャンセル・self 5体黄枠 (opp 非黄枠)・
    victim クリックで switch 成立 (新キャラ登場)。
  - nMax>1 scene pick → EffectPickerModal フォールバックが **画像付き** で描画 (soft-lock 防止 BLOCKER 検証、現場黄枠なし)。
- 設計レビュー: opus 3-lens (correctness-lifecycle / rules-equivalence / regression-scope) = 全 **GO-with-fixes**、blocker+fix 反映済。

### out of scope (follow-up 候補)

GuardPickerModal / MisreadPickerModal も self 現場キャラを text-only 選択する同型問題を持つが、contact-guard /
相手推理防御の別フロー (pendingEffectPick 非経由・contact-store/Promise 駆動) のため本件対象外。
