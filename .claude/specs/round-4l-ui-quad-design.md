---
name: round-4l-ui-quad-design
date: 2026-05-21
round: 4l
status: design + implemented
related:
  - .claude/bugs/BUG-001.md
  - .claude/bugs/BUG-002.md
  - .claude/bugs/BUG-010.md
---

# Round 4l — UI 4 課題一括対応 design

## 課題と対応

### 1. BUG-002 (S, edition tag 隙間)
- 修正: `Playmat.css .left-col { gap: 6px → 0 }` (1 line)
- 影響: 事件↔edition tag↔証拠 の縦隙間消失

### 2. BUG-001 (M, カード拡大 modal)
- 新規: `CardExpandModal.tsx` + `.css` (z-index 1600、backdrop/ESC/× で close)
- 新規: `useCardExpandModal.ts` hook (`{ expandedCard, open, close }`)
- 編集: Playmat.tsx に hook 統合、PlayerMat に `onExpand` prop 追加
- 編集: PartnerArea/SceneArea/CaseArea に `onExpand` prop 追加、isCandidate=false 時に click で onExpand 起動

### 3. BUG-010 (M, opp turn 可視化)
- 編集: `OppTurnOverlay.tsx` — `activeActionId` 中は「相手がアクション解決中…」表示
- 編集: `OppTurnOverlay.css` — `.opp-turn-safety-cap` style 追加 (font-size 12px, 薄色)
- 追加: 「安全上限 200 手」(= PLAY_TURN_SAFETY_CAP) 明示表示
- 既存: `useOppTurnDriver` は Phase 8 で既に `pauseOnAction: true` 使用済

### 4. B5 観戦モード (M, 新機能)
- 編集: `store.ts` — `spectatorMode: boolean` + `setSpectatorMode` setter
- 新規: `useSpectatorTurnDriver.ts` — `spectatorMode && turnPlayer === 'self'` で self ターンを AI 自動進行 (useOppTurnDriver と対称)
- 編集: `GameSetupModal.tsx` — 「観戦モード (AI vs AI)」button 追加、`handleSpectate` で `performGameStart` + `setSpectatorMode(true)`
- 編集: `Playmat.tsx` — `useSpectatorTurnDriver()` を `useOppTurnDriver()` の隣に追加

## 検証結果
- typecheck clean / docs:check clean
- unit **1476 PASS + 1 skipped** (回帰なし)
- E2E **38 PASS + 1 skipped** (UI 変更で DOM 影響なし)
- smoke **525/475 完全維持**

## commit
`feat(ui): Round 4l — UI 4 課題一括対応 (BUG-001/002/010 + B5 観戦モード)`
