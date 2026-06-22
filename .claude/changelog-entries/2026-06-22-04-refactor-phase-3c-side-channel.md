# 全体リファクタ Phase 3c — globalThis side-channel 縮減 (挙動不変)

**Round/Phase**: 2026-06-22 リファクタ計画 (`.claude/specs/refactor-plan/`) Phase 3c。
高リスク群につき **着手前フルパネル設計レビュー** (Workflow opus 4 lens) + 挙動不変ゲート全通過で実施。
骨格凍結原則の「動作不変な内部最適化」例外に該当。

### 調査補正 (計画 5ch → 安全 2ch)
read/write 全サイトを直読みした結果、計画の移設対象 5ch のうち **3ch は globalThis が load-bearing** と判明し KEEP:
- `__pendingEffectChoiceResume` / `__pendingEffectOptionalResume` = **cross-dispatch holder**
  (walk が dispatch N で set、apply-pick が dispatch N+1 で **新規 ctx 構築**して take → ctx.dyn 不可)。
- `__pendingEffectOptionalSide` = **store-drain + cross-module read** (stack.ts:121 / apply-pick:454)。
- `__pendingDeckRevealSide` / `__pendingDeckReorderSide` = **store-drain** (atom → UI modal)。

### 実施した安全 2ch
- **① `__chainStepNoApply` → `ctx.dyn.chainStepNoApply`**: chain break 信号。reader は resolver.ts chain case のみで、
  resolver.run が全 child run()/runAtom へ **同一 ctx を clone せず素通し** するため、atom-handler (core.ts ×3) /
  tryRePickFromAtom 経由の walk (resolve-picks ×2) が立てた値を同一 ctx で読む = intra-produce。globalThis 不要。
  内部機構を直 assert する test 5 件を ctx 捕捉へ移送 (`.toBe(false)` 2 件は `dyn:{chainStepNoApply:false}` pre-init)。
- **② `__pendingEffectChoiceBindings` を `__pendingEffectChoiceResume` holder の {effect,bindings} 格納形に統合**:
  両 channel は常にペアで set/take/clear されるため 1 globalThis slot に集約。pending-state.ts 内部のみ
  (export 関数シグネチャ不変) で importer (apply-pick/resolve-picks/test) 改変 0。take/clear は null-safe (`if(g)` ガード)。
- 結果: **declare-global slot 13 → 11** / **side-channel lint channel 13 → 12**。

### 検証 (全 GREEN)
- 着手前フルパネル設計レビュー (Workflow opus 4 lens, 613k tok): Lens1 INVARIANCE-HOLDS / Lens2 REFUTED →
  **BLOCKER 1** (統合 take/clear の null-unsafe 化 = apply-pick の desync graceful-return を破る) を `if(g)` ガードで解消 /
  Lens3 (test 移送 recipe) 解消 / Lens4 scope 妥当。実装後 opus 1 agent: **APPROVE** (BLOCKER/MAJOR 0)。
- tsc **0** / full vitest **2783 pass / 1 skip** (baseline 一致) / smoke:1000 **winsA=498** (timeouts0/exceptions0) /
  e2e 3 spec **26 pass** / eslint **127→125** (削除した declare-global 2 本の不要 eslint-disable directive warning -2、
  **新規 problem 0・error 数 77 不変**) / 規約 lint 8 本 errors=0。

### 学び (恒久)
- side-channel を「ctx.dyn/continuation へ移せる」と判断する前に、**dispatch 境界を跨ぐか**を reader の
  ctx-identity で確定する。cross-dispatch holder は apply-pick が dispatch ごと ctx を再構築するため ctx.dyn 不可。
- 逆に intra-produce flag (chainStepNoApply) は ctx.dyn が globalThis と **同一共有意味** (resolver が ctx を素通し)。
- 2 channel を 1 backing object に統合する際は **take/clear を null-safe** に保つ (現行 top-level `?? null` の
  graceful return を破らない。desync guard より先に take が走る経路を踏む)。
