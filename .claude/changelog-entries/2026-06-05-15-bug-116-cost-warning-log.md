## BUG-116 修正案 A 実装: useDeclaredAbility に cost-not-paid warning log を追加

**Round/Phase**: 2026-06-05 session 残課題対処 — BUG-116 (Phase B で登録) を修正案 A で対応

### 変更内容 (engine, 1 ファイル)

`src/engine/flow/main/declared-ability.ts` の `useDeclaredAbility` 関数に、
**cost 定義あり + ctx.costPaid 不在** を検出した時点で **warning log を append** する path を追加。

```diff
  if (ability.type !== 'declared' || !ability.effect) return;

+ // BUG-116 (2026-06-05): cost が定義されているのに ctx.costPaid 不在 → cost 未払い疑い。
+ if (ability.cost && !ctx?.costPaid) {
+   mutate.log.append(state, {
+     ts: Date.now(),
+     player: found.player,
+     turn: state.turn.number,
+     action: 'declaredAbility:cost-not-paid',
+     target: `${uid}:${abilId}`,
+     result: 'WARN: ability.cost 定義あり / ctx.costPaid 不在 — cost 未払いで effect 解決へ',
+   });
+ }

  const resolveCtx: EffectCtx = { ... };
```

### 設計判断

- **既存挙動は変えない**: effect は引き続き queue される。throw も skip もしない。
- **caller (UI/AI) の責務として扱う**: rules 違反だが engine 層は detect のみ、教訓 1 と同じ pattern
- **log だけで早期検出可能に**: e2e / 直接 dispatch の cost 漏れを log inspection で見つけられる

### 検証

- typecheck clean / lint:listener / lint:bugs / lint:side-channel 全 OK
- 新規 unit test 3 件 (`tests/engine/flow/main/declared-ability.test.ts` BUG-116 describe):
  - cost あり + costPaid 不在 → warning log 記録
  - cost あり + costPaid 提供 → warning なし
  - cost 未定義 → warning なし
- 全 vitest 1766 pass · 1 skip (回帰 0、baseline 1764 + 新規 3 = 1767、BUG-077 flaky -1)
- 全 e2e 22/22 pass (engine-extensions + reuse-cards)

### BUG-116 close

frontmatter:
- `status`: 未着手 → **修正済 (warning log path / cost auto-pay は別途検討)**
- `date_fixed`: 2026-06-05
- `commit`: (本コミット)

### 残課題

修正案 B (dispatcher で ability.cost を自動取得 + 自動 pay) は別途検討。
本修正は最小 (additive log のみ) で完結し、cost 漏れの **検出** を可能にした。
**自動修正** (auto-pay) は副作用範囲が大きいため、UI/AI 経路で実害が確認できてから対応する。
