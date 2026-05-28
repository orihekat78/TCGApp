---
date: 2026-05-28
title: ネクストヒント step2 UI 実装 + 反復可能化 + HandZone pick-mode 統合 (BUG-080 / BUG-081)
type: fix
scope: ui
---

## ユーザー指摘

> ネクストヒントはそもそも挙動がおかしいので修正してほしい。

rules/12 を再確認した結果、**engine は正しい** が **UI に 2 つのバグ**:

- **[BUG-080](.claude/bugs/BUG-080.md)** (主因): NH step2 (カード使用) が UI に完全欠落。
  engine `runNextHint(state, p, optionalCardId)` は step1+step2 atomic 対応済だが、UI が
  `optionalCardId` を渡さず step1 (FILE→手札) のみ実行されていた
- **[BUG-081](.claude/bugs/BUG-081.md)**: NH button が初回使用後に永久 disabled。rules/12
  では「制限なし」(同ターン何度でも可、FILE が尽きるまで) だが UI が `nextHintUsed` で塞いでいた

## Option A 採択 (atomic, engine 不変)

骨格凍結原則準拠。engine の atomic 設計を尊重し、UI 側で「FILE-top + 使用可能手札」を
picker で事前提示、選択結果を 1 dispatch で渡す。

## 実装

### Phase 1: bug fix + 専用 modal (commit 9380314)

- **新規** [src/ui/hooks/useNextHintPicker.ts](src/ui/hooks/useNextHintPicker.ts) —
  Zustand store + Promise hook。`ask({fileTopCardId, fileTopName, candidates})` →
  `Promise<{kind:'use';cardId} | {kind:'skip'} | {kind:'cancel'}>` (useConfirmation 同型)
- **書換** [src/ui/hooks/useActionsPanelFlow.ts](src/ui/hooks/useActionsPanelFlow.ts)
  `runNextHintFlow`:
  1. FILE-top cardId 算出 ([mutate/file.ts popTop](src/engine/mutate/file.ts#L37) と同ロジック)
  2. postPopCount = (非アシスト FILE 枚数 - 1)。候補 = `[fileTopCardId, ...hand]` を
     `readDef.card(id)` で `level ≤ postPopCount` かつ 色 ⊆ 事件色 で filter
  3. `await useNextHintPicker().ask({...})` → use/skip/cancel に応じて dispatch 分岐
- **変更** [src/ui/components/ActionsPanel.tsx](src/ui/components/ActionsPanel.tsx) —
  新 prop `canNextHint` を受け `disabled: !canNextHint`。subtitle に「(使用済)」表示
- **変更** [src/ui/components/Playmat.tsx](src/ui/components/Playmat.tsx) —
  `canNextHint={engineFlow.canStartNextHint(gameState, 'self')}` を渡す
- 新 test: [tests/ui/hooks/useNextHintPicker.test.ts](tests/ui/hooks/useNextHintPicker.test.ts) /
  [tests/ui/hooks/useActionsPanelFlow.nextHint.test.ts](tests/ui/hooks/useActionsPanelFlow.nextHint.test.ts)

### Phase 2: UX 改善 — HandZone 統合 (commit db08c74)

ユーザ要望「**手札を拡大した UI で出せるカードを黄色枠でピックアップ選択したい**」反映。
専用 modal (NextHintPickerModal) を廃止し HandZone pick-mode を汎用化して再利用。

- [src/ui/components/HandZone.tsx](src/ui/components/HandZone.tsx) — `pickBannerText` /
  `pickableCardIds` / `pickSkipLabel` / `onPickCancel` / `pickCancelLabel` prop 追加。
  `pickableCardIds` 外は dim + 選択不可、内は黄色枠 (`.hand-card--pickable`)
- [src/ui/components/Playmat.tsx](src/ui/components/Playmat.tsx) — useNextHintPickerStore
  subscribe → NH pick 中は手札自動展開、FILE-top を合成カードとして手札末尾に追加、
  `onPickCard→acceptUse / onPickSkip→acceptSkip / onPickCancel→acceptCancel` に分岐
- `NextHintPickerModal.tsx/.css` 削除

## 検証

- typecheck clean / vitest 1615 PASS
- Playwright 実機 (console error 0):
  - **use** (FILE-top 合成カード選択): scene に 名乗り active 登場、FILE 3→2、
    `nextHintUsed=true`、`handUseUsed=false`
  - **skip**: step1 のみ (FILE-top 手札追加、scene 登場なし)
  - **cancel**: state 不変
  - **反復可能 (BUG-081 fix)**: NH 後も button enabled (FILE 2枚 使用済 表示)
  - **NH 後の通常手札使用 disabled**: 残0回 (rules/12 §Point 維持)
  - レベル/色不適合カード (D08009 Lv5) は dim + 選択不可

## 水平展開

- 既存 discard-pick (`effectPickResolve`) は pickableCardIds 未指定で全カード pickable の
  従来動作を維持、回帰なし
- ActionsPanel 全 button の disable 条件を audit 済、engineFlow.canXxx / state 値ベースで
  独自誤フラグ転用なし (NH のみが過去誤実装)

engine 変更ゼロ (骨格凍結原則準拠)。
