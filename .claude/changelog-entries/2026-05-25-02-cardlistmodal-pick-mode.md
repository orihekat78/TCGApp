---
date: 2026-05-25
title: CardListModal pick mode 統合 — evidence pick が証拠エリア展開 UI で完結 (User vision 実現)
type: feat
scope: ui
---

## User vision: CardListModal を pick UI として流用

ユーザー指摘 (BUG-077 後): 効果対象選択モーダル (EffectPickerModal) は裏向き証拠
でも cardId/カード名が見えてしまう。一方、証拠エリアを click した時の展開モーダル
(CardListModal) は「非公開」と正しく扱える。

→ CardListModal を pick UI として流用する設計が望ましい。

## 実装

### CardListModal (`src/ui/components/CardListModal.tsx`)

- `pickCands?: Array<{uid, cardId, player}>` と `onPick?: (uid) => void` props 追加
- pick mode 時、face-down cell (evidence) は `evidence:<side>:<idx>` の uid 一致で
  click 可能な button に変換 → onPick 発火
- face-up cell (remove 等) は `<cardId>#<idx>` 合致 + fallback で uid 解決
- CSS: `.card-list-item--pickable` で 金色 border + hover scale ハイライト

### Playmat (`src/ui/components/Playmat.tsx`)

- `useEffect` で pendingEffectPick.atomVerb を監視:
  - `evidenceToHand` → `areaModal = {kind:'evidence', side:'self'}` を auto-open
  - `handAddFromRemove` → 同 `kind:'remove'`
- pick が消えた (resolve 後) ら auto-close
- CardListModal に pickCands / onPick を pass through

### EffectPickerModal (`src/ui/components/EffectPickerModal.tsx`)

- `AREA_PICK_VERBS = {evidenceToHand, handAddFromRemove}` を skip
  → 該当 pick 時は本 modal を表示しない (CardListModal に譲る)
- scene char / 他のキャラ pick (sceneRemove 等) は引き続き本 modal を使用

## 動作確認 (Playwright)

D08013 a1 を実機 play:

1. 手札使用 → 場登場 → step 1 evidenceGain (+D08015 to evidence)
2. **「自分の証拠エリア (1 枚)」CardListModal が自動 open**、「(非公開)」button が金色ハイライト
3. click → 証拠 0 / 手札 +D08015 ✓
4. step 3: 「効果対象を選択」EffectPickerModal が表示 (hand pick)
5. 円谷光彦 click → 手札 -D08011 / リムーブ +D08011 ✓

## 検証

- vitest 1578 PASS / 1 skipped
- typecheck clean
- Playwright 実機: D08013 a1 全 3 step 完全動作、CardListModal で pick 完結

## 残課題

- discard (hand pick) は EffectPickerModal を使用 → HandZone 直接 click 化は別 task
- card-list-pick-* testid 命名で E2E test 安定化可
