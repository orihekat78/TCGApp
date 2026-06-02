# カットイン選択 HandZone pick 化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コンタクト中の自分のカットイン選択を、テキストボタン modal ではなく `HandZone.pickMode`（手札拡大 + カットイン可能カードを黄色枠 + パス skip）で行う。

**Architecture:** `useContactFlowDriver` は変更不要（候補0で既に自動パス）。`Playmat` で `useContactModalStore.cutInDisguise`（self + cutin候補あり + 変装候補なし）を `HandZone.pickMode` として描画し、その間は旧 modal を出さない。dispatch は既存 `actionContact{cutin|pass}` + `actionAdvance`。

**Tech Stack:** React 19 + zustand + Playwright e2e + Vitest。

**設計ソース:** [docs/superpowers/specs/2026-06-02-cutin-handzone-pick-design.md](../specs/2026-06-02-cutin-handzone-pick-design.md)

---

## File Structure
- Modify: `src/ui/components/Playmat.tsx` — cutin pick 派生 + HandZone props + auto-expand + modal guard（唯一の実装変更）。
- Modify: `tests/e2e/opp-turn-contact.spec.ts` — self cutin の cid-modal 期待を hand-pick に更新。
- Create: `tests/e2e/cutin-handzone-pick.spec.ts` — cutin hand-pick の pick / pass を検証。
- 不変: `useContactFlowDriver.ts`（候補0自動パス済）/ `CutInDisguisePickerModal.tsx`（変装 dormant 用に残す）/ engine。

---

## Task 1: Playmat — cutin を HandZone pick mode で描画

**Files:** Modify `src/ui/components/Playmat.tsx`

- [ ] **Step 1: 派生 state + handler を追加**（既存 pick 派生群の近く、`handleScenePick` 定義の直後あたり）

```typescript
// カットイン選択 (User 要望): useContactModalStore.cutInDisguise を HandZone pick mode (黄色枠) で扱う。
// self + cutin候補あり + 変装候補なし のときのみ hand-pick。変装候補あり (MVP では発生せず) は旧 modal。
const cutInStore = useContactModalStore((s) => s.cutInDisguise);
const cutInHasDisguise = (cutInStore?.candidates ?? []).some((c) => c.kind === 'disguise');
const isCutinPick =
  cutInStore !== null &&
  cutInStore.player === 'self' &&
  cutInStore.candidates.some((c) => c.kind === 'cutin') &&
  !cutInHasDisguise;
const cutinPickableIds = isCutinPick
  ? new Set(cutInStore!.candidates.filter((c) => c.kind === 'cutin').map((c) => c.cardId))
  : undefined;
const cutinBannerText = cutInStore
  ? `カットインするカードを選択（パス可）— ${cutInStore.actorLabel}${cutInStore.actorName ? `（${cutInStore.actorName}）` : ''}`
  : undefined;
const handleCutinPick = (uid: string): void => {
  const cur = useContactModalStore.getState().cutInDisguise;
  if (!cur) return;
  const cardId = uid.split('#')[0]!;
  useContactModalStore.getState()._setCutInDisguise(null);
  dispatchEngineAction({ type: 'actionContact', actionId: cur.actionId, player: cur.player, choice: { kind: 'cutin', cardId } });
  dispatchEngineAction({ type: 'actionAdvance', actionId: cur.actionId });
};
const handleCutinPass = (): void => {
  const cur = useContactModalStore.getState().cutInDisguise;
  if (!cur) return;
  useContactModalStore.getState()._setCutInDisguise(null);
  dispatchEngineAction({ type: 'actionContact', actionId: cur.actionId, player: cur.player, choice: { kind: 'pass' } });
  dispatchEngineAction({ type: 'actionAdvance', actionId: cur.actionId });
};
```

- [ ] **Step 2: auto-expand effect を追加**（既存の discard / nextHint auto-expand effect の隣）

```typescript
// カットイン判断中も HandZone を自動 expand (手札拡大から選択)
useEffect(() => {
  if (isCutinPick) setHandExpanded(true);
}, [isCutinPick]);
```

- [ ] **Step 3: HandZone props に isCutinPick を合流**（`<HandZone ...>` の該当 props を置換）

```tsx
          pickMode={isDiscardPick || isNextHintPick || isCutinPick}
          pickableCardIds={isCutinPick ? cutinPickableIds : isNextHintPick ? nextHintPickableIds : undefined}
          pickHideBanner={isNextHintPick}
          pickBannerText={
            isCutinPick ? cutinBannerText
            : isNextHintPick ? `使うカードを選択（黄枠 / レベル${nextHintPick!.postPopCount}以下）`
            : undefined
          }
          pickSkipLabel={isCutinPick ? 'パス' : isNextHintPick ? '使用しない' : undefined}
          onPickCancel={isNextHintPick ? () => useNextHintPicker().acceptCancel() : undefined}
          pickCancelLabel={isNextHintPick ? 'キャンセル' : undefined}
          onPickCard={
            isCutinPick ? handleCutinPick
            : isNextHintPick ? (uid: string) => useNextHintPicker().acceptUse(uid.split('#')[0]!)
            : isDiscardPick ? (uid: string) => { dispatchEngineAction({ type: 'effectPickResolve', pickedUid: uid }); }
            : undefined
          }
          pickCanSkip={
            isCutinPick ? true
            : isNextHintPick ? true
            : isDiscardPick && (pendingPickForArea?.nMin ?? 1) === 0
          }
          onPickSkip={
            isCutinPick ? handleCutinPass
            : isNextHintPick ? () => useNextHintPicker().acceptSkip()
            : isDiscardPick ? () => { dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null }); }
            : undefined
          }
```

- [ ] **Step 4: modal guard** — `PlaymatCutInDisguisePickerModal` を「変装候補ありのときだけ open」に変更。関数冒頭の `if (!current)` を置換:

```typescript
  const current = useContactModalStore((s) => s.cutInDisguise);
  const hasDisguise = (current?.candidates ?? []).some((c) => c.kind === 'disguise');
  if (!current || !hasDisguise) {
    return (
      <CutInDisguisePickerModal
        open={false}
        actorLabel="1番目"
        candidates={[]}
        onPickCutIn={() => {}}
        onPickDisguise={() => {}}
        onPass={() => {}}
      />
    );
  }
```

- [ ] **Step 5: typecheck** `npx tsc --noEmit` Expected: 0 エラー。
- [ ] **Step 6: 既存 unit/通し test** `npx vitest run tests/ui` Expected: 全 PASS（`CutInDisguisePickerModal.test.tsx` は modal 不変で PASS）。
- [ ] **Step 7: commit** `git add src/ui/components/Playmat.tsx && git commit -m "feat(ui): カットイン選択を HandZone pick mode (黄色枠) へ"`

---

## Task 2: e2e — cutin hand-pick の pick / pass を検証

**Files:** Create `tests/e2e/cutin-handzone-pick.spec.ts`、Modify `tests/e2e/opp-turn-contact.spec.ts`

- [ ] **Step 1: 新規 e2e spec を作成**（`cutin-fixed-ap.spec.ts` を盤面テンプレに、UI 経路で検証）

```typescript
import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState, dispatchAction, getActiveActionId, expectNoConsoleErrors } from './helpers';
import type { GameStateLike } from './helpers';

// self が 2番目 (action-2) でカットイン判断するコンタクトを組み、HandZone pick (黄色枠) で
// cutin カードを選択 / パスできることを検証する。盤面は cutin-fixed-ap.spec と同型。
test.describe('カットイン HandZone pick (黄色枠で選択 / パス)', () => {
  // 盤面ビルダは cutin-fixed-ap.spec.ts L48-80 を踏襲（self-2 vs opp-2、hand に D08017 を追加）。
  test('cutin 可能カードが黄色枠で表示され、click で cutInUsed が立つ', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    // ... buildGameState で self-2(AP8000) vs opp-2(AP6000 sleep)、self.hand=['D08017'] を構築 ...
    // ... action 宣言 → opp pass → advance で action-2 (self=second, self cutin 判断) まで進める ...
    // 期待: 手札 auto-expand + D08017 が pickable (黄色枠)
    const card = page.locator('.hand-card--pickable[data-card-id="D08017"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();
    // cutInUsed['self'] === true を state 経由で確認
    const used = await page.evaluate(() => (window as unknown as { __gameState?: { actionContext?: { cutInUsed?: Record<string, boolean> } } }).__gameState?.actionContext?.cutInUsed?.self);
    expect(used).toBe(true);
    expectNoConsoleErrors(errors);
  });

  test('パス skip ボタンで cutin せず action 完了', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    // ... 同盤面で action-2 (self cutin 判断) まで進める ...
    await page.locator('[data-testid="hand-zone-pick-skip"]').click();
    await expect.poll(() => getActiveActionId(page)).toBeNull();
    expectNoConsoleErrors(errors);
  });
});
```

  注: `buildGameState` / `dispatchAction` の正確な引数は `tests/e2e/patterns/cutin-fixed-ap.spec.ts` L48-83 を参照しコピーする（self-2=D11006 AP8000, opp-2=D08006 sleep AP6000, hand に cutin カード追加, dispatch chain で action-2 まで）。`__gameState` 露出が無ければ `expectCutInUsed` helper を使用。

- [ ] **Step 2: 新規 spec を実行** `npx playwright test tests/e2e/cutin-handzone-pick.spec.ts` Expected: 2 PASS（実装後）。
- [ ] **Step 3: opp-turn-contact.spec.ts を更新** — 「self cutin 判断 → cid-picker-modal 表示 → cid-pass」を hand-pick に置換。`L120-128` 付近の `cid-picker-modal` / `cid-pass` 待ちを、`isCutinPick` では cid modal が出ない前提に変更し、pass は `[data-testid="hand-zone-pick-skip"]` をクリック（modal が出ない=変装無しのため）。candidates 0 の auto-pass 分岐は不変。

```typescript
    // self cutin 判断: 変装無しのため cid modal は出ず HandZone pick (黄色枠) になる。
    const cutinCard = page.locator('.hand-card--pickable').first();
    if (await cutinCard.isVisible().catch(() => false)) {
      await page.locator('[data-testid="hand-zone-pick-skip"]').click(); // パス
    }
    // else: 候補0で auto-pass 済 (従来通り)
```

- [ ] **Step 4: opp-turn-contact を実行** `npx playwright test tests/e2e/opp-turn-contact.spec.ts` Expected: PASS。
- [ ] **Step 5: commit** `git add tests/e2e/cutin-handzone-pick.spec.ts tests/e2e/opp-turn-contact.spec.ts && git commit -m "test(e2e): カットイン HandZone pick の選択/パス検証 + opp-turn 更新"`

---

## Task 3: 全検証 + Playwright headed + design doc 整合 + 最終 commit

**Files:** Modify `docs/superpowers/specs/2026-06-02-cutin-handzone-pick-design.md`（e2e 範囲の注記修正）

- [ ] **Step 1: 全 suite** `npx tsc --noEmit && npx vitest run && npx playwright test` Expected: 全 PASS / console error 0。
- [ ] **Step 2: smoke** `npm run smoke:1000` Expected: 例外0（UI 変更なので engine 不変、baseline 一致）。
- [ ] **Step 3: Playwright headed 目視**（CLAUDE.md「画面表示≠機能確認」）: 人間 vs CPU で self がコンタクト2番目になる状況を作り、(a) 手札が自動展開し cutin カードが黄色枠、(b) クリックで AP+ 反映 + コンタクト解決、(c) パスで解決、(d) 候補0で自動パス、を確認。
- [ ] **Step 4: design doc 修正** — §4 テスト節の「`cutin-fixed-ap.spec.ts` を更新」を「`cutin-fixed-ap.spec.ts` は engine action 直 dispatch のため影響なし。更新対象は `opp-turn-contact.spec.ts` + 新規 `cutin-handzone-pick.spec.ts`」に訂正。
- [ ] **Step 5: docs 再生 + commit** `npm run docs && git add -A && git commit -m "docs: カットイン HandZone pick 完了 (design 整合 + 再生)"`

---

## Self-Review
- **Spec coverage:** §1 scope(cutin-only)→Task1 isCutinPick gate / §2 dataflow→Task1 Step1-4 / §3 自動パス→driver 既存(不変, 設計§3 と整合) / §4 test→Task2-3。全項目に対応 Task あり。
- **Placeholder scan:** Task2 の盤面ビルダは既存 spec L48-83 参照を明示（コピー元あり）。engine action 直 dispatch のため cutin-fixed-ap 不要を Task3 で訂正。
- **Type consistency:** `cutInStore`/`isCutinPick`/`cutinPickableIds`/`cutinBannerText`/`handleCutinPick`/`handleCutinPass` を Task1 内で一貫使用。`_setCutInDisguise`/`dispatchEngineAction`/`actionContact`/`actionAdvance` は既存 API。
