# memory — 現セッション scratchpad

## セッション㊴ (2026-06-22) — refactor Phase 3c 完了 (globalThis side-channel 縮減 2ch)

branch `refactor/phase-3c` (main `50ac6b0a` = 3b から分岐)。挙動完全不変 (骨格凍結の動作不変例外)。

### 調査補正 — 計画 5ch → 安全 2ch
read/write 全サイト直読みで 3ch は globalThis load-bearing と判明 → **KEEP**:
- ChoiceResume/OptionalResume = cross-dispatch holder (apply-pick が dispatch ごと **新規 ctx 構築** して take)。
- OptionalSide = store-drain + cross-module read (stack.ts:121 / apply-pick:454)。DeckReveal/Reorder = store-drain。
ctx は dispatch 単位で再構築されるため dispatch 境界を跨ぐ値は globalThis が必須。**ユーザー承認後** 2ch に縮小。

### 実装 (2 Change)
- **A: `__chainStepNoApply` → `ctx.dyn.chainStepNoApply`** — reader=resolver chain case のみ、resolver.run が
  全 child run()/runAtom へ同一 ctx 素通し→atom-handler(core ×3)/tryRePickFromAtom(resolve-picks ×2)が同一 ctx に立て
  resolver:101 が読む (intra-produce)。touch: resolver/core/resolve-picks/scene(comment) + test 2 file (5 assert を
  ctx 捕捉へ、`.toBe(false)` 2 件 dyn pre-init)。
- **B: `__pendingEffectChoiceBindings` を `__pendingEffectChoiceResume` holder の {effect,bindings} 統合** —
  pending-state.ts 内部のみ・export 不変 → importer 改変 0。take/clear は **null-safe** (`if(g)` ガード)。
  lint allowlist から 'EffectChoiceBindings' 除去。

### レビュー (フルパネル opus 4 lens 613k tok)
- Lens1 INVARIANCE-HOLDS / Lens2 REFUTED → **BLOCKER** (統合 take/clear が null-unsafe → apply-pick:236 take が
  desync guard 前に走り g=null で TypeError、現行 `?? null` graceful return を破る) を `if(g)` ガードで解消 /
  Lens3 (test 移送 recipe: ctx 捕捉・pre-init・行番号) 解消 / Lens4 scope 妥当。実装後 opus 1 agent: APPROVE。

### 検証 (全 GREEN)
- tsc **0** / full vitest **2783 pass / 1 skip** (baseline 一致) / smoke:1000 **winsA=498** (timeouts0/exceptions0) /
  e2e 3 spec **26 pass** / eslint **127→125** (削除 declare-global 2 本の不要 eslint-disable directive warning -2、
  **新規 0・error 77 不変**) / 規約 lint 8 本 errors=0 / declare-global slot **13→11** / side-channel lint **13→12**。
- 決定論検証: `grep -E '^\s*var __' src` = 11 (anchored)。`__chainStepNoApply`/`__pendingEffectChoiceBindings` の
  生 token が src に 0 (コメント含む)。eslint stash-diff で removed = pending-state の 2 unused-directive warning のみ・added 0。

### 学び (恒久)
- side-channel 移設可否は **dispatch 境界を跨ぐか**で決まる。cross-dispatch holder は apply-pick が ctx 再構築 → ctx.dyn 不可。
  intra-produce flag は ctx.dyn が globalThis と同一共有意味 (resolver が ctx 素通し)。
- 2 channel→1 backing 統合は take/clear を null-safe に (desync guard 前に take が走る経路あり)。
- 記録分割: review-records.md が 100 行制約超過 → Phase 1a〜2c を review-records-1.md へ分離。

### commit / 次
docs 再生成 → 明示 add (.gitignore/.superpowers/.claude/design/reports 除外) → 1 commit → main ff-merge → push (要認可、
後 `git ls-remote origin main` + CI green 確認)。次: 3d (UI hooks 分割) / 4 (周辺整理) / デザイン刷新。`/clear` 推奨。

---

## セッション㊵ (2026-06-22) — refactor Phase 3d 完了 (UI hooks 分割)
3c は main 取込み済 (d9223011, push + CI green 確認済)。ユーザー選択で Phase 3d (両ファイル 1 commit) に着手。
- **実装** (100% byte-identity): useActionsPanelFlow.ts (909) → barrel + useActionsPanelFlow/{cost,enumerators,flows}.ts。
  useEngineDispatch.ts (677) → barrel + useEngineDispatch/{types,can-check}.ts。runEngineAction + `_justDeclaredAxId` +
  dispatchEngineAction は barrel KEEP。決定論 codemod (scripts/_phase3d_codemod.mjs、commit 除外) + 独立 HEAD verifier。
- **着手前フルパネルレビュー** (opus 4 lens + critic, 690k, BLOCKER 0) で scope 補正 → runEngineAction 分離 + EngineAction
  family 型化を **新 Phase 3e へ繰り延べ** (理由: `_justDeclaredAxId` の cross-module shared-mutable 化 [BUG-034 category] /
  両 switch に default:never ガード無く tsc が型化 member 脱漏を捕捉不能)。本 phase は byte-identity に純化。
- **ゲート全 GREEN**: tsc0 / vitest 2783+1skip / smoke winsA=498 / e2e 26 / eslint stash-diff added=0 removed=0 (125) /
  規約 lint 8 errors=0 / slot 11 不変 / side-channel 12ch 不変。
- 途中 **opus classifier の長時間障害** (~1h) で commit がブロック、ScheduleWakeup で再試行し復帰後に完了。

### 学び㊵
- module-let の produce 境界越え side-channel を cross-module 分離するのは挙動不変でも convention 逸脱 (BUG-034 は
  そのカテゴリを globalThis 化で回避済) → writer/reader 同居 KEEP が最小リスク。分離する場合は globalThis 化 + lint 整合とセット。
- family union「型化」は tsc 単独では member 脱漏を捕捉できない (switch に default:never 必須 / noImplicitReturns 不在)。
  型化する phase では switch 網羅性ガードを同時導入する (3e)。
- 抽出先専用 import は barrel から除去要 (noUnusedLocals が即捕捉)。file-private の export 昇格は sub-file 限定で barrel 非公開。

### commit㊵ / 次
明示 add (7 src + sub-files + auto docs + 記録 md、_phase3d_codemod.mjs と .claude/reports/_phase3d は除外) → 1 commit →
main ff-merge → push → CI green。次: **Phase 3e** (useEngineDispatch 続き) / Phase 4 (周辺整理) / デザイン刷新。`/clear` 推奨。
