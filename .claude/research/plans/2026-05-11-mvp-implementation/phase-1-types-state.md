# Phase 1: 型・GameState・RNG

**Goal:** [engine-api-types.md](../../../specs/engine-api-types.md) と [ui-state-map.md](../../../specs/2026-05-11-ui-state-map.md) に従って TypeScript 型を全定義し、GameState の初期化 + 決定的 RNG を実装する。

**Files:**
- Create: `src/engine/types/{game-state.ts, candidate.ts, effect-ctx.ts, hooks.ts, results.ts, index.ts}`
- Create: `src/engine/rng.ts`
- Test: `tests/engine/types.test.ts`, `tests/engine/rng.test.ts`

---

### Task 1.1: GameState 型定義

- [ ] **Step 1:** `src/engine/types/game-state.ts` に [ui-state-map.md](../../../specs/2026-05-11-ui-state-map.md) の `GameState/PlayerState/SceneCharacter/PartnerOnBoard/EvidenceCard/FileCard/TurnScopedFlags/LogEntry/Effect/CardId/EvidenceOrigin` を全コピー
- [ ] **Step 2:** `tests/engine/types.test.ts` 作成: `const s: GameState = { ... }` で型エラーなく作れることを assert (`expectTypeOf`)
- [ ] **Step 3:** `npm test` PASS / `npm run typecheck` 通過
- [ ] **Step 4:** commit `feat(engine): GameState 型定義`

### Task 1.2: 補助型 (Candidate, EffectCtx, Results, HookName)

- [ ] **Step 1:** `src/engine/types/candidate.ts` に Candidate union (engine-api-types.md)
- [ ] **Step 2:** `src/engine/types/effect-ctx.ts` に EffectCtx + ContactCtx (G21/G24 反映)
- [ ] **Step 3:** `src/engine/types/results.ts` に RemoveResult/RefreshResult/JudgeResult/PayResult/CostPreview/ValidationResult/GameResult/ActionContext/ActionPhase 等
- [ ] **Step 4:** `src/engine/types/hooks.ts` に HookName union ([engine-api-events.md](../../../specs/engine-api-events.md) 末尾)
- [ ] **Step 5:** `src/engine/types/index.ts` で全 re-export
- [ ] **Step 6:** typecheck 通過確認 + commit

### Task 1.3: 決定的 RNG (engine.rng)

- [ ] **Step 1:** test `tests/engine/rng.test.ts`:

```typescript
import { createRng } from '@/engine/rng';
it('seed同一なら同列', () => {
  const a = createRng('s1'); const b = createRng('s1');
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
});
it('shuffle 全要素保持', () => {
  const r = createRng('x'); const out = r.shuffle([1,2,3,4,5]);
  expect(out.sort()).toEqual([1,2,3,4,5]);
});
```

- [ ] **Step 2:** RUN: 失敗確認 (createRng 未定義)
- [ ] **Step 3:** `src/engine/rng.ts` 実装 (mulberry32 + Fisher-Yates):

```typescript
export function createRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i=0;i<seed.length;i++){h = Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  let s = h>>>0;
  const next = () => { s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s>>>15, 1 | s); t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
    return ((t ^ t>>>14) >>> 0) / 4294967296; };
  return {
    next,
    shuffle<T>(arr: T[]): T[] {
      const a = arr.slice();
      for (let i = a.length-1; i > 0; i--) { const j = Math.floor(next()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
      return a;
    },
    choice<T>(arr: T[]): T { return arr[Math.floor(next()*arr.length)]; },
  };
}
```

- [ ] **Step 4:** PASS 確認 + commit `feat(engine): deterministic RNG`

### Task 1.4: GameState ファクトリ (空状態)

- [ ] **Step 1:** test `tests/engine/state-factory.test.ts`:

```typescript
import { createEmptyGameState } from '@/engine/state-factory';
it('空 GameState 作成', () => {
  const s = createEmptyGameState();
  expect(s.turn.number).toBe(0);
  expect(s.players.self.scene).toEqual([]);
  expect(s.pendingEffects).toEqual([]);
});
```

- [ ] **Step 2:** RUN 失敗確認
- [ ] **Step 3:** `src/engine/state-factory.ts` 実装 (全フィールド null/empty で初期化)
- [ ] **Step 4:** PASS + commit

### Task 1.5: Immer producer wrapper

- [ ] **Step 1:** test: state を Immer 経由で変更しても元 state は変わらない
- [ ] **Step 2:** `src/engine/produce.ts` で `import { produce } from 'immer'` を re-export + `current` `original` も
- [ ] **Step 3:** PASS + commit

## 完了基準

- 全型定義あり (typecheck 通過)
- RNG が決定的 (seed同一で再現)
- 空 GameState 作成可能
- Immer 動作確認済

→ Phase 2 へ
