## Engine 拡張 #3: multi-target Pattern A pick + B02021 沖田総司

**Round/Phase**: 2026-06-05 engine-extension-plan.md step 3

「N枚まで選び、それぞれを (per-char) AP/LP/レベル ±/sleep/remove」のパターン (23 枚解禁) を解禁。
`apply-pick.ts` の Pattern A (uid='$pick') を **pickedUids 配列に対応** させ、各 uid に
atom を per-char 適用する sequence へ展開する。

### 変更内容 (additive)

#### `src/engine/effect/apply-pick.ts` (applyPickAndContinuation)

```diff
- let resolvedAtom: { kind: 'atom'; verb: never; args: Record<string, unknown> };
+ let resolvedAtom: Effect;
  if (isPatternA) {
    const { target: _omit, ...restArgs } = pending.atomArgs;
    void _omit;
-   resolvedAtom = { kind: 'atom', verb: pending.atomVerb as never, args: { ...restArgs, uid: pickedUid } };
+   const uids = (pickedUids && pickedUids.length > 1) ? pickedUids : [pickedUid];
+   if (uids.length === 1) {
+     resolvedAtom = { kind: 'atom', verb: pending.atomVerb, args: { ...restArgs, uid: uids[0]! } };
+   } else {
+     const atoms = uids.map((u) => ({ kind: 'atom', verb: pending.atomVerb, args: { ...restArgs, uid: u } }));
+     resolvedAtom = { kind: 'sequence', steps: atoms };
+   }
  }
```

### 互換性 (回帰 0 の根拠)

- `pickedUids` 未指定 or 1 件のみ → 単一 atom (旧挙動)
- `pickedUids.length > 1` → 各 uid を sequence で per-char 適用 (新挙動)
- AI 経路の `chooseAiPick` は既に `nMax > 1` で pickedUids を返していたため、こちらが apply
  側に届くようになっただけ (旧は drain 後 1 件のみ消費、残りは silent ignore = BUG)
- typecheck clean / 全 vitest 1753 pass · 1 skip (回帰 0、baseline 1749 + 新規 4)

### 実装カード batch #1

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B02021 | 0191 | 沖田総司 | 【宣言】【ターン1】相手の現場のキャラを5枚まで選び、ターン終了時までAP-1000 (+【ヒラメキ】sleep) |

### 検証

- 新規 unit (`tests/engine/effect/multi-target-pick.test.ts`) 4/4 pass
  - pickedUids 単一 → 旧動作 (Pattern A 1 件適用)
  - pickedUids 複数 → 各 uid に atom per-char 適用
  - 部分選択 (3 候補中 2 件) → 選んだ 2 件のみ適用
  - AI drain 経路 (nMax>1 greedy) → 全候補に適用
- 新規 e2e (`tests/e2e/engine-extensions-2026-06-05.spec.ts`) +1 件 = 計 4/4 pass
  - B02021 a1: 3 体 multi-pick → pendingEffectPick(charModifyAP) → effectPickResolve(pickedUids:3)
    → 全 3 体に AP-1000 が反映されることを read.char.ap で実機検証
- ALL_CARDS 872 枚 (+1)

### 残実装

- B05039 松田左文字: 「レベル5を2枚まで + レベル7を1枚まで選び」(separate pick groups) → 別形式
- 多くの 0191/0528 系 multi-target カードは本変更で実装可能になった
