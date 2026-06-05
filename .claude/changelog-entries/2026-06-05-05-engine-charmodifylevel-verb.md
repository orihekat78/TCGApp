## Engine 拡張 #2: charModifyLevel verb 追加 (レベル±N)

**Round/Phase**: 2026-06-05 engine-extension-plan.md step 2

Engine 拡張 #2: 「レベル±N」効果 (17 枚解禁) のための `charModifyLevel` verb を additive に追加。
従来 throw stub だった `charSetLP` / `charSetAP` とは別軸 — こちらは「**±N (delta)**」専用で、
modifyAP/modifyLP と完全対称な実装。frozen engine 修正は最小限 (5 ファイル)。

### 変更内容 (additive)

- **`src/engine/types/effect.ts`**: AtomVerb union に `'charModifyLevel'` を追加
- **`src/engine/mutate/char.ts`**: `modifyLevel(s, uid, delta, scope)` — `turnEffects['lvlMod_<scope>']`
  へ delta を蓄積 (modifyAP/LP と同型)
- **`src/engine/read/char.ts`**: `level()` を 3 scope 合算へ拡張
  (`lvlMod_permanent` / `lvlMod_turn` / `lvlMod_contact`)
- **`src/engine/target/candidates.ts`**: filter `levelMin` / `levelMax` 評価で 3 scope 合算を使用
  (旧は printed level のみ → AP/LP 既に effective-value 化済なのに level だけ非対称だったバグも解消)
- **`src/engine/effect/atom-pick-spec.ts`**: `charModifyLevel: { defaultArea:'scene', mode:'PA', needs:'delta' }`
- **`src/engine/effect/atom-handlers.ts`**: `case 'charModifyLevel'` (PA 短縮形 + skip-unresolved + 確定 uid)

### 互換性 (回帰 0 の根拠)

- `modifyLevel` 不使用時: `lvlMod_*` は undefined → 加算結果は base + 0 + 0 + 0 = 旧挙動と完全一致
- 既存カードに level を動的に modify するものは無し (skim 確認済) → effective level 切り替えで
  既存カードの挙動は変わらない
- typecheck clean / 全 vitest 1745 pass · 1 skip (回帰 0, baseline 1736 + 新規 9)

### 検証

- unit test (atom-handlers.test.ts +4 / read/char.test.ts +2 / target/effective-value-filter.test.ts +3) 計 9 件
- e2e (`reuse-cards-2026-06-05.spec.ts`) 9/9 pass
- typecheck clean / lint:listener errors=0

### 次ステップ (step 2.5)

レベル±N を必要とするカード 17 枚の実装。代表例:
- 「キャラを1枚まで選び、ターン終了時までレベル±N」(短縮形 `charModifyLevel { delta, max:1, scope:'turn' }`)
- 「自分のキャラを1枚レベル+1」「相手のキャラを1枚レベル-2」等
