# UI picker Direct Manipulation 化 — 設計 (2026-06-15)

> 由来: cluster14 MCP 実機でユーザー指摘「ピッカーが text-only で同名カード(吉田歩美×3)が区別不能・
> 現場カードを直接選べない」。原則 = memory `feedback-ui-direct-manipulation`。**UI 層のみ / engine 不変**。

## 確定スコープ (決定論 scan (one-shot、結果を以下に記載)、全1211カード)

- pick area 分布: **scene 150 / remove 22 / hand 18**。EffectPickerModal に落ちる pick は **100% scene-char** (非scene/mixed は **0 件**)。
- scene pick は **全て n.max=1** (multi-select UI 不要)。side は either/self/opp。
- 直接選択が必要な verb: 既存 `sceneRemove`(15)/`charModifyAP`(14) + **新規** `sceneSetState`(78)/`charGrantKeyword`(19)/`charSetCard`(5)/`charSetTurnEffect`(4)/`sceneToHand`(3)。

## 設計 (3 part)

### Part A — scene-char pick を verb 白名簿 → 候補ベース検出に一般化
`isScenePick` の `(atomVerb==='sceneRemove'||'charModifyAP')` を廃し、次で判定:
- `pending.player==='self'` かつ `nMax===1` かつ **全 candidate.uid が両 scene の SceneCharacter.uid に存在**。
- → sceneSetState 等 7 verb + 将来の scene verb を自動被覆。`scenePickUidsSelf/Opp` 構築は現状のまま (both-scene 既対応)。
- 単一クリック→ `effectPickResolve {pickedUid}` (既存 handleScenePick)。skip overlay (nMin=0) も既存流用。banner 文言のみ verb 非依存に汎用化。

### Part B — EffectPickerModal: scene pick では出さない + 残置 fallback に画像
- render 条件を「候補が全て scene char なら null (Playmat が直接処理)」に変更 (Part A と同じ判定で二重 UI 防止)。
- 非scene/mixed (現状0件・将来用) のときのみ modal を出し、各候補に `<CardArt>` サムネ追加 (同名識別 = ユーザー要望#1 の保険)。

### Part C — switch victim を現場直接クリックで収集
switch victim は **常に self 現場カード**。`useSceneSwitchPickerStore`(Promise resolver) は維持し、**描画のみ** modal→直接クリックへ:
- `switchPickerActive = store.current!==null` のとき self 現場の `current.candidates` を `effect-pickable` 化、click→`current.resolve(uid)`+`_close()`。
- banner overlay (既存 `scene-pick-skip-overlay` 流用) に「退場キャラを選択 (i/n)」+ **キャンセル**ボタン (辞退=`resolve(null)`)。
- `<PlaymatSceneSwitchPickerModal/>` (card list modal) は撤去。3 文脈で機能:
  1. hand-use switch (runHandUseFlow): playmat 可視 → そのまま直接クリック。
  2. 単一 sceneEnter overflow (resolveSceneEnterPick) / 3. multi sceneEnter overflow (onPickMulti loop): **area CardListModal を hide してから** 直接クリック (下記 modal lifecycle)。

### Modal lifecycle (Part A/C 統合)
- scene-direct-pick (Part A の switch 以外) では area modal は元々開かない (scene pick は area modal 非対象) → 干渉なし。
- switch victim 時: `switchPickerActive` の間は (a) area modal の render を抑止 `{areaModal && !switchPickerActive && ...}`、(b) auto-open useEffect を gate (`if (switchPickerActive) return`)。closure の `uids` は保持されるので確定後 dispatch で復帰。

## GameState → UI 対応 (変更点)
| state | UI 反映 |
|---|---|
| `pendingEffectPick`(scene/n=1) | self+opp SceneArea の該当 char が `effect-pickable` (黄枠) + click 可 |
| `useSceneSwitchPickerStore.current` | self SceneArea の victim 候補が `effect-pickable` + banner overlay |
| `areaModal` | switchPickerActive 中は非表示 |

## ルール整合
- rules/20 §スイッチ: 名乗り/スリープ/スタン 全て victim 可 → candidates は全 scene char (engine 既算出、UI は素通し)。辞退=cancel(resolve null) 維持。
- rules/15 §「〜まで」=0枚可: nMin=0 の scene pick は skip overlay 維持。
- rules/03 §現場: 5枚上限・both-scene 表示は SceneArea 既存。
- out of scope: engine の候補算出・pick 解決ロジック (一切不変)。color/特徴 filter は engine 側で候補に反映済。

## エッジケース (≥5)
1. **同名 decoy** (吉田歩美×3 self): 各々別 SceneCharacter.uid → 別カードとして黄枠+画像、click で個別解決 (本件の主目的)。
2. **opp 現場 pick** (sceneToHand side=opp / sceneSetState either): opp SceneArea も黄枠化 (scenePickUidsOpp 既存)。
3. **現場0枚で scene pick**: candidates 0 → engine が pick を生成しない (cardLikeCands 0 = chain break)、UI は何も出さない。
4. **switch victim 0/n キャンセル**: banner の キャンセル → resolve(null) → 既存辞退経路 (multi は skipResolvesAtom で後続 FILE-1 解決)。
5. **multi sceneEnter overflow 2体退場**: loop で 1体ずつ直接クリック、victim 済みは候補から除外 (既存 filter)、banner i/n 更新。
6. **switch 中に area modal が裏に**: render 抑止 + auto-open gate で二重 backdrop/クリック不能を防止。
7. **scene re-render 中クリック**: ghost (removing) は onClick 無効 (SceneArea 既存 isGhost gate)。

## レビュー反映 v2 (opus 3-lens 敵対設計レビュー 2026-06-15、全 GO-with-fixes)

- **[BLOCKER] 述語共有**: `isSceneDirectPick(pending,gameState)` 純関数を新規 (`src/ui/services/scenePick.ts`)。
  = `player==='self' && nMax===1 && candidates>0 && 全 candidate.uid ∈ (self∪opp scene uid)`。
  Playmat(`isScenePick`) と EffectPickerModal(null-gate) が **同一 import**。Part B は helper===true のときのみ null →
  将来 nMax>1 scene pick は helper false → EffectPickerModal が画像付きで必ず描画 (soft-lock 回避)。
- **[fix] skip-overlay 文言の verb 汎用化** (最重要): 新規5verb は全て nMin=0 → overlay 常時 render。
  banner/skip ボタン両方を verb 別ラベル (sceneRemove=リムーブ/charModifyAP=効果適用/sceneSetState=状態変更/
  charGrantKeyword=能力付与/charSetCard=カードをセット/charSetTurnEffect=効果付与/sceneToHand=手札に戻す) に。
  skip ボタンは中立『選ばない』。`data-testid='scene-pick-skip'` 維持。
- **[fix] switch banner は新規ブロック**: 既存 skip-overlay は `isScenePick` 限定 (switch 中は false) で出ない。
  `switchActive(store.current!==null)` 起点の新 overlay (『退場キャラを選択 i/n』+ キャンセル=resolve(null))、CSS class のみ流用。
- **[fix] pickCharUids/onPickChar MUX**: self=`switchActive? victimUids : scenePickUidsSelf` / `switchActive? handleSwitchVictim : handleScenePick`。
  opp=switch 中は空 (victim 常に self)。3 switch 文脈すべてで isScenePick=false なので排他 (検証済)。
- **[fix] flicker 回避**: `switchSessionActive` state を area-pick 2 caller (resolveSceneEnterPick/onPickMulti) で
  _open 前に true・dispatch/cancel 後に false。area-modal render + auto-open useEffect を `!switchSessionActive` で gate
  (deps に追加、lint green)。dispatch と false 化を同 tick (batched) で trailing-frame 再表示を消す。
- **[fix] 撤去ファイル確定**: `SceneSwitchPickerModal.tsx`+`.css`+`tests/ui/components/SceneSwitchPickerModal.test.tsx` を
  **同 commit で削除**。`SceneSwitchCharView` 型は `useSceneSwitchPickerStore.ts` へ移設。store は維持。
- **[out of scope]** GuardPickerModal / MisreadPickerModal も self 現場キャラを text-only 選択する同型問題を持つが、
  contact-guard / 相手推理防御の別フロー (pendingEffectPick 非経由・contact-store/Promise 駆動) のため本件対象外 (follow-up 候補)。
- **[検証追加]** MCP に opp 現場 direct-click (rotate180 hit-test) + opp 同名 decoy 取り違え無し を必須化。

## 検証計画
- tsc0 / vitest 全 green (UI 変更だが既存 test の dispatch 契約不変)。
- smoke winsA 不動 (AI 経路は pendingEffectPick を直接 resolve、UI 非経由 → 影響なし)。
- **MCP 実機**: 同名 decoy 盤面で (a) sceneSetState 直接クリック+画像識別、(b) opp 現場 pick、(c) hand-use switch 直接クリック、(d) multi sceneEnter overflow switch を踏む。console err0。
