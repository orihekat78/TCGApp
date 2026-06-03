# 設計: カットイン選択を HandZone pick mode へ (2026-06-02)

## ゴール
コンタクト中の自分のカットイン選択を、テキストボタン modal (`CutInDisguisePickerModal`) ではなく **手札拡大表示UI (`HandZone.pickMode`)** で行う。カットイン可能カードを **黄色枠** (`pickableCardIds`) で強調し、タップで選択 / パスは skip ボタン。手札にカットイン可能カードが無ければ **自動パス**。

- **対象**: カットインのみ (MVP デッキに変装カードは存在しない)。
- **不変**: engine / contact flow のルール処理は変更しない (UI 配線のみ)。

## アプローチ
既存 `HandZone.pickMode`(discard / ネクストヒントで実証済) を流用する **Approach A**。新規 UI ほぼゼロ、既存 pick UX と一貫。「手札の拡大表示UIを流用」というユーザー要望そのもの。

## アーキテクチャ
self のコンタクト判断 (action-1/2/再行動) を `HandZone.pickMode` 経由に切替。変装は MVP にカードが無いため旧 modal パスを **dormant** (将来の変装カード用ガード) で残す。

## データフロー
- **`useContactFlowDriver`**: self decider で cutin 候補を算出。
  - **空 (かつ変装候補なし) → `actionContact{kind:'pass'}` + `actionAdvance` を即 dispatch (自動パス, store を開かない)**。
  - 非空 → 従来通り `useContactModalStore._setCutInDisguise({ actionId, player:'self', actorLabel, actorName, candidates })`。
- **`Playmat`**: store から `isCutinPick = (cutInDisguise!=null && player==='self' && cutin候補あり && 変装候補なし)` を導出。`isCutinPick` のとき:
  - 手札を auto-expand (discard と同じ effect パターン)。
  - `pickMode` ON / `pickableCardIds = new Set(cutin候補 cardId)` (黄色枠) / `pickCanSkip = true`。
  - `pickBannerText = "カットインするカードを選択（パス可）— <1番目/2番目/再行動>（<actorName>）"`。
  - `onPickCard = (uid) => { close(); dispatch actionContact{kind:'cutin', cardId: uid.split('#')[0]}; dispatch actionAdvance; }`。
  - `onPickSkip = () => { close(); dispatch actionContact{kind:'pass'}; dispatch actionAdvance; }`。
  - `isCutinPick` の間は `PlaymatCutInDisguisePickerModal` を出さない (変装候補ありの時のみ modal)。
- **HandZone pickMode の合流**: Playmat の `pickMode={isDiscardPick || isNextHintPick || isCutinPick}` 等に `isCutinPick` を追加し、`pickableCardIds`/`pickBannerText`/`onPickCard`/`pickCanSkip`/`onPickSkip` を分岐。

## エッジケース
- **候補0枚 → 自動パス** (UI を出さない)。
- **パス** = skip ボタン (`pickCanSkip`)。
- **opp / spectator** → AI (`ai.chooseCutIn`、変更なし)。
- **将来の変装カード / cutin+変装 両対応カード** → 旧 modal にフォールバック (dormant ガード, MVP 不発)。
- **actor 情報** (1番目/2番目/再行動 + カード名) → banner に表示。
- **手札 auto-expand** は判断中のみ、解決後に元の expand 状態へ。
- **複数 cutin 候補** → 全て黄色枠、いずれか1枚選択 (1コンタクト1枚は engine `cutInUsed` で保証、変更なし)。

## テスト
- **unit**: `useContactFlowDriver` 自動パス (候補0で store を開かず `actionContact{pass}` dispatch)。
- **e2e**: `cutin-fixed-ap.spec.ts` は engine action を直接 dispatch するため UI 変更の影響なし（不変）。更新は `opp-turn-contact.spec.ts`（cid-modal 期待 → `hand-zone-pick-skip`）+ 新規 `cutin-handzone-pick.spec.ts`（黄色枠 click → `contact-cutin` log / skip → パス）。判定は安定する `gameState.log` の `contact-cutin`(player) を使用（action context は完走時に消えるため）。
- **Playwright headed**: 黄色枠表示 / pick / パス / 自動パス / banner actor 表示 を実機確認 (console error 0)。

## 関連
- 現状 UI: `src/ui/components/CutInDisguisePickerModal.tsx` (テキストボタン, 変装用に残す)
- 流用先: `src/ui/components/HandZone.tsx` (`pickMode`/`pickableCardIds`/`onPickCard`/`pickCanSkip`)
- 配線: `src/ui/components/Playmat.tsx` / `src/ui/hooks/useContactFlowDriver.ts` / `useContactModalStore.ts`
- engine: `src/engine/flow/contact.ts` (`canCutIn`/`cutIn`、変更なし)
