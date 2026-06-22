## refactor(ui): Phase 3e — useEngineDispatch exhaustiveness ガード (default:never)

UI の EngineAction dispatch 2 switch に `default:never` 網羅性ガードを追加 (挙動完全不変・additive/compile-time-only)。
tsconfig は `noFallthroughCasesInSwitch` 有だが **`noImplicitReturns` 無**のため、将来 EngineAction に member を追加して
case を書き忘れると switch を silent fall-through する穴があった。これを compile error 化する。

- **`runEngineAction`** (void) と **`isAllowed`** (boolean) の switch 末尾に inline
  `const _exhaustive: never = action; void _exhaustive;` + `return;` / `return false;` を追加。
  両 switch は現在 24 discriminant tag 全網羅ゆえ default は到達不能 → runtime 完全不変。
- **throw 不使用**: `isAllowed` は `dispatchEngineAction` の try 外で呼ばれ、throw 系 assertNever だと未知 action が
  uncaught 例外で貫通し挙動破壊するため。現状の falsy fall-through と等価な `return false` に固定。
- helper 不使用 (repo 既存 8 サイトが全てインライン展開、戻りが void/false の 2 種で単一化不可)。
- **着手前フルパネル設計レビュー** (Workflow opus 4 lens + synthesis、509k tok、BLOCKER 0、4/4 一致 minimal) で当初 4
  sub-goal の scope を裁定: runEngineAction 物理分割 (barrel 490<500 で size 動機ゼロ + axId cross-module 化が BUG-034
  category) と axId globalThis 化 (slot 11→12 で headline ≤7 逆行・3c 打消し) を **DROP**、EngineAction family 型化を
  **SUBSUMED** (full-union default:never が member-drop 全捕捉) とし、ガード追加のみに純化。
- **水平展開**: engine 層 `applyMove` (src/ai/policy.ts:209、Move 11-member union、default 0) が同型の silent-gap を持つ。
  骨格凍結原則ゆえ本 phase では触らず **Phase 3f** に trace。
- 検証 GREEN: tsc0 (両 tsconfig) + 負テスト (case 1 削除→TS2322) / vitest 2783+1skip / smoke winsA=498 / e2e 26 /
  eslint 125 (added0) / 規約 lint 8 本 errors=0 / slot 11 据置 / numstat additive-only (各 7add/0del)。
