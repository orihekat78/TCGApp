---
date: 2026-05-25
title: HandZone pick mode + effectPickResolve 候補再解決 — discard pick が手札拡大表示で完結
type: feat
scope: ui / engine
---

## User 指摘 2 点を解決

1. **step 3 候補に step 2 で追加された card が含まれない** (BUG-078 既知 follow-up)
2. **hand pick も「手札拡大表示から選択」したい** (User vision を hand にも適用)

## 実装

### effectPickResolve cardId 再解決 (`src/ui/hooks/useEngineDispatch.ts`)

`pending.candidates` は queue push 時の snapshot。sequence の先行 step (例: D08013 step 2
evidenceToHand) で当該 area の内容が変化すると stale。`resolveCardIdFromPickUid` を導入:

- `evidence:<side>:<idx>` → 現在の `gameState.players[side].evidence[idx].cardId`
- `<cardId>#<idx>` → uid prefix の cardId をそのまま使用

これにより queue 時に存在しなかった card (step 2 で追加された hand card 等) も pick 可能に。

### HandZone pick mode (`src/ui/components/HandZone.tsx`)

- `pickMode?: boolean` / `onPickCard?: (uid) => void` props 追加
- pick mode 時、expanded view の各 card cell が click → `onPickCard(`<cardId>#<idx>`)`
- 既存 onCardClick (手札使用) は suppress

### Playmat 自動 expand (`src/ui/components/Playmat.tsx`)

- `pendingEffectPick.atomVerb === 'discard'` を `isDiscardPick` で検出
- useEffect で `handExpanded = true` に自動 set
- HandZone に `pickMode={isDiscardPick}` と onPickCard を pass through

### EffectPickerModal: discard も非表示 (`src/ui/components/EffectPickerModal.tsx`)

- `AREA_PICK_VERBS` に 'discard' 追加 → discard pick 時は HandZone 拡大表示に譲る

## 動作確認 (Playwright)

D08013 a1 を実機 play:

1. step 1 evidenceGain (+D08015 to evidence)
2. CardListModal で「(非公開)」click → 証拠 0 / 手札 7 枚 (末尾に D08015 追加)
3. **HandZone 自動 expand**、step 3 discard pick mode active
4. 7 枚目 cell (step 2 で追加された D08015) を click → 手札 6 枚 / リムーブ +D08015 ✓
5. BUG-078 follow-up 解消: queue 時に無かった card も pick 可能

## 検証

- vitest 1578 PASS / 1 skipped
- typecheck clean
- Playwright 実機: D08013 a1 全 3 step 完全動作、step 2 で追加された card も step 3 で選択可能
