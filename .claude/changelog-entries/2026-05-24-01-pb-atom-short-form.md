---
date: 2026-05-24
title: Pattern B atom 短縮形対応 — `{player, n}` だけでカードが書けるように (D08013 で実証)
type: feat
scope: engine / cards
---

## 物理動作 atom 短縮形

カード DSL を「公式テキストの動詞列をそのまま atom 呼出列に翻訳するだけ」にするため、Pattern B atom (`evidenceToHand` / `discard` / `handAddFromRemove`) に **target 省略形** を導入。

### Before / After

```typescript
// Before (D08013 a1 step 2): 11 行の冗長な pick query
{
  kind: 'atom', verb: 'evidenceToHand',
  args: { player: 'self', target: {
    kind: 'pick',
    query: { area: 'evidence', side: 'self' },
    n: { min: 1, max: 1 },
    chooser: 'self',
  } },
}

// After: 1 行
{ kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } }
```

D08013.ts 全体: 89 行 → 53 行 (40% 圧縮、`choice` ラップも除去できた)。

### 仕組み

- `src/engine/effect/resolve-picks.ts`:
  `substituteAtomPick` で `target === undefined && typeof n === 'number'` の場合、
  verb 既定 (`PB_DEFAULT_PICK_AREA`: evidenceToHand → 'evidence' / discard → 'hand' /
  handAddFromRemove → 'remove') で pick query を補完。
- `src/engine/effect/atom-handlers.ts`:
  defensive coding として atom-handler 側でも同様の `defaultPickTarget` 補完。
  直接 `runAtom` を呼ばれた場合 (test 等) でも短縮形を受け付ける。
- AI 経路: `picked.kind === 'evidence'` の場合 `state.players[p].evidence[i].cardId` を pickValue に採用 (旧コードは null フォールバックで諦めていた)。
- Human 経路: 既存 BUG-077 fix の挙動を維持 (初期 walk では side-channel set せず、runtime tryRePickFromAtom 経由のみ)。

### 検証

- 新規 test Phase F (`tests/engine/effect/bug-077-evidence-to-hand-e2e.test.ts`):
  短縮形 `{player, n}` で human 経路 runtime に side-channel が evidenceToHand 用に正しく set
- 新規 test Phase G: 短縮形 + AI heuristic 経路で target が cardId 配列に解決
- vitest 1577 PASS / 1 skipped (新規 2 件追加)
- typecheck clean、smoke 1000 戦 0 例外 (winsA=511/winsB=489)
- Playwright 実機: D08013 a1 step 2 で evidence cardId='D08007' が modal 表示、選択後
  evidence=0 / hand に D08007 追加を確認

### 後続

- D08015 等の他 PB 利用カードへの短縮形移行 (人間が実装担当時に随時)
- BUG-078 (step 3 modal) は引き続き未解決、別途対応
