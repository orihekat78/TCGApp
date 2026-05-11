# UI 全体構成・コンポーネント分解 (2026-05-11)

公式プレイシートに忠実な縦割りレイアウト + React コンポーネント階層の定義。

## 画面レイアウト (1920×1080想定)

```text
┌─────────────────────────────────────────────────────────────────┐
│ <TopBar> 章タグ ｜ フェイズ ｜ pendingEffects ｜ 痕跡 ｜ ©       │ 36px
├─────────────────────────────────────────────────────────────────┤
│ <PlayerMat side="opp"> (相手・180°回転)                          │ 約370px
│   ┌────────┬──────────────┬─────────┐                          │
│   │事件    │ 現場(5)       │ デッキ   │                          │
│   ├────────┼──────────────┼─────────┤                          │
│   │証拠    │ パートナー    │ リムーブ │                          │
│   ├────────┴──────────────┴─────────┤                          │
│   │       FILEエリア (裏向き横向き)  │                          │
│   └─────────────────────────────────┘                          │
├─────────────────────────────────────────────────────────────────┤
│ <KeepOutDivider> ─ KEEP OUT ─ KEEP OUT ─                          │ 16px
├─────────────────────────────────────────────────────────────────┤
│ <PlayerMat side="self"> 同じ構造 (回転なし)                       │ 約370px
├─────────────────────────────────────────────────────────────────┤
│ <HandZone> [c1][c2][c3][c4][c5][c6] <EndTurnButton>              │ 110px
├─────────────────────────────────────────────────────────────────┤
│ <LogBar> (閉時 32px / 展開時 200px)                              │ 32px
└─────────────────────────────────────────────────────────────────┘
<ModalLayer>            (z-index: 1000)
<FullscreenOverlay>     (z-index: 2000, 勝利/敗北/リフレッシュ)
```

## React コンポーネント階層

```text
<App>
└─ <GameScreen state={GameState} ui={UIState}>
   ├─ <TopBar />
   │  ├─ <ChapterTag />
   │  ├─ <PhaseStrip />
   │  ├─ <EffectStackIndicator />
   │  └─ <ScratchTraceIndicators />        // 痕跡 自/相
   ├─ <PlayerMat side="opp|self">
   │  ├─ <CaseZone>
   │  │   └─ <CaseCard /> (with <StatusStamp> 事件編/解決編)
   │  ├─ <SceneZone>
   │  │   └─ <SceneCharCard /> × 5 (with badges)
   │  ├─ <DeckZone>
   │  │   └─ <CardBackStack count />
   │  ├─ <EvidenceZone clickable />
   │  ├─ <PartnerZone>
   │  │   └─ <PartnerCard />
   │  ├─ <RemoveZone clickable />
   │  └─ <FileZone />
   │      └─ <CardBackSideways /> × N + <AssistedPartnerInFile />
   ├─ <KeepOutDivider />
   ├─ <HandZone> <HandCard /> × N
   ├─ <EndTurnButton />
   ├─ <LogBar />
   ├─ <ModalLayer>
   │  ├─ <ConfirmModal />
   │  ├─ <ActionMenu />
   │  ├─ <CardDetailModal />
   │  ├─ <EvidenceExpandModal />
   │  ├─ <RemoveExpandModal />
   │  ├─ <GuardSelectionModal />          // 相手側応答
   │  ├─ <MisleadActivationModal />
   │  ├─ <HiramekiActivationModal />
   │  ├─ <SearchModal />                  // 捜査X
   │  ├─ <SwitchTargetModal />            // 現場5枚時
   │  ├─ <OptionalEffectModal />          // 「〜してもよい」
   │  ├─ <TargetMultiSelectModal />       // 「〜枚まで選び」
   │  ├─ <DeclaredAbilitySelector />
   │  ├─ <CutInDisguiseChoiceModal />     // コンタクト中
   │  ├─ <MulliganModal />                // 開始時
   │  └─ <TurnOrderDecisionModal />        // 先攻決定
   └─ <FullscreenOverlay>
      ├─ <RefreshOverlay />
      ├─ <AutoPhaseSequenceOverlay />
      ├─ <VictoryScreen />
      └─ <DefeatScreen />
```

## 責任分離の原則

- **Zone**: レイアウト + クリック受付。GameState を見ない (props経由のみ)
- **Card 系**: 描画専門。アクション・状態変化のロジックは持たない
- **Modal 系**: 一時的UI。閉じれば消える。GameState 変更前のプレビューのみ
- **Overlay**: フルスクリーン演出。ゲーム不可逆な瞬間 (リフレッシュ/勝利/敗北)

## サイズ仕様 (1280×720 時)

マット高 250px / カードサイズ約75%縮小 / 手札高80px。

## 関連

- [ui-state-map.md](2026-05-11-ui-state-map.md)
- [ui-style-anim.md](2026-05-11-ui-style-anim.md)
