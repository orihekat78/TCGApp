## refactor(engine): Phase 3g — resolve-picks chain-case exhaustiveness ガード

`resolveEffectPicks` (src/engine/effect/resolve-picks.ts:431) の `switch (effect.kind)` に `case 'chain'` を追加
(negate/custom と並べた明示 passthrough) + `default` を網羅性ガード化。3f の水平展開で発見した silent-gap
(Effect union 11 member のうち chain が `default: return effect` に落ち un-walked) を塞ぐ。挙動完全不変。

- 末尾を `case 'chain': case 'negate': case 'custom': return effect;` +
  `default: { const _exhaustive: never = effect; void _exhaustive; return effect; }` に再構成。
  全 11 member を明示 case 化したため default は到達不能 → `noImplicitReturns` 不在で member 脱落が
  silent passthrough する穴を compile error (TS2322) 化。sibling `resolver.ts:174` との構造非対称を解消。
- **chain は walk せず passthrough (Option A)**: chain の step 内 atom `$pick` は pre-walk ではなく **dispatch 時**
  (`resolver.ts:78` chain case → `run(step)` → atom-handler `tryRePickFromAtom`) に解決されるため、passthrough で drop なし。
- **throw 不使用 (return 変種)**: `resolveEffectPicks` は `applyMove`→`declared-ability.ts:199` 経由で `produce()` try 外
  (`ai/policy.ts:419-423`) から到達。throw だと将来到達可能化した際に stepTurn を貫通するため (Phase 3e/3f と同判断)。
  `resolver.ts` が throw なのは run() が dispatch sink で未処理 kind=実バグ (loud fail) ゆえの正当な非対称。
- **着手前 opus 3 lens 設計レビュー** (403k tok、BLOCKER 0、GO): invariance=invariant / 骨格凍結=例外「動作不変な内部最適化」/
  活性バグ=**無し** (ALL_CARDS 1374 枚 object-walk で chain step の choice/optional = subtree 含め 0 件)。
  Option B (chain walk 救済) は出荷カード 0 件ゆえ latent future-only ([BUG-152](.claude/bugs/BUG-152.md))。
- 検証 GREEN: tsc0 (両 tsconfig) + 負テスト (`case 'chain'` 削除→TS2322@resolve-picks.ts(574,13)) / vitest 2783+1skip /
  smoke winsA=498 (exceptions0/baseline OK) / e2e 26 / eslint 125 (added0) / 規約 lint 8 本 errors=0 /
  numstat 16add/1del (**additive でなく default アーム再構成** — 挙動不変は byte-identity でなく実行差分で担保)。
