# Phase 3c 設計 — globalThis side-channel 縮減 (2026-06-22)

挙動完全不変 (骨格凍結の「動作不変な内部最適化」例外)。決定論検証 + 着手前フルパネル設計レビュー。

## 調査補正 (計画 5ch → 安全 2ch)

phases.md §3c の計画は「__pendingEffectChoiceBindings / OptionalSide / OptionalResume /
DeckRevealSide / chainStepNoApply を continuation・EffectCtx へ」だが、read/write 全サイト直読みで
**3ch は globalThis が load-bearing** と判明 → KEEP に補正:

| channel | 性質 (根拠 file:line) | 判定 |
|---|---|---|
| `__pendingEffectChoiceResume` / `…OptionalResume` | **cross-dispatch holder**。walk (dispatch N) で set、apply-pick が **新規 ctx 構築** (apply-pick.ts:240-251 / 285-292) して dispatch N+1 で `_takePending*`。ctx は dispatch ごと再生成 → ctx.dyn 不可 | KEEP |
| `__pendingEffectOptionalSide` | **store-drain + cross-module read** (apply-pick.ts:454 human-gating / stack.ts:121 evCardId 比較)。produce 戻り値を跨ぐ escape | KEEP |
| `__pendingDeckRevealSide` / `…ReorderSide` | **store-drain** (picks.ts atom→_shared.ts drain→UI modal)。produce 内 set→同 dispatch で drain | KEEP |

→ ctx は dispatch 単位で再構築されるため、dispatch 境界を跨ぐ値は globalThis が必須。
GameState 自体への格納は serialization-bearing 化 + smoke baseline 比較対象拡大で別リスク (out of scope)。

## Change A — `__chainStepNoApply` → `ctx.dyn.chainStepNoApply`

**根拠 = intra-produce で ctx 共有参照**:
- reader は **resolver.ts:99 (chain case) のみ**。chain case は step ごとに L85 で reset → run(step) → L99 read。
- writer: core.ts:121/145/257 (filePopToHand/fileRemoveTop/evidenceToHand fromTop の no-op)、
  resolve-picks.ts:276/320 (walk の no-candidate)。scene.ts:287 は **コメントのみ** (書込み無し)。
- resolver.run は全 child run() と runAtom に **同一 ctx を素通し** (clone 無し)。runAtom (atom-handlers.ts:86)
  も handler へ同一 ctx。`ctx.dyn =` 再代入は src/engine 全体で **ゼロ** (grep 確認) → ctx.dyn は run() tree 内で共有可変。
- resolve-picks.ts:276/320 の write は **2 経路** (review Lens1/4 指摘で精緻化):
  - **dead 経路 (初期 walk)**: walk (resolveEffectPicks) に chain case 無し (default→未walk) のため、初期 walk
    から到達した 276/320 set は reader 不在の dead write。移設後も walk-ctx.dyn への dead write (resolver は
    event.queue で別 ctx 再構築) で無害。
  - **live 経路 (runtime、invariance の核心)**: resolver chain step が pick-atom を run → atom-handler awaiting-pick
    (core.ts atomDiscard 等) → `tryRePickFromAtom(...,ctx,...)` → substituteAtomPick が cands=0 で 276 write。
    この ctx は resolver.ts:88 run(step,ctx)→atom-handlers.ts:86 runAtom(...,ctx)→handler(...,ctx)→tryRePickFromAtom(...,ctx)
    と **無変更で届く同一参照** = resolver:99 が読む ctx → 移設後も live read 保持 → 挙動不変。
- nested chain: 外/内 chain は同一 ctx を共有 (resolver が ctx 素通し) → globalThis と **同じ共有意味**。差分ゼロ。
- nested chain: 外/内 chain は同一 ctx を共有 (resolver が ctx 素通し) → globalThis と **同じ共有意味**。差分ゼロ。

**実装**: write `(ctx.dyn ??= {}).chainStepNoApply = true`、reset `(ctx.dyn ??= {}).chainStepNoApply = false`、
read `ctx.dyn?.chainStepNoApply === true`。pending-state.ts の declare global `var __chainStepNoApply` を削除。

**テスト移送 (必須・production と同時、review Lens3 で精緻化)**: 内部機構を直 assert する 2 test が globalThis を読む。
これは単純置換ではなく **呼出サイト再構成** を要する (ctx は inline 渡しで未捕捉のため):
- 機械抽出した flag-assert read (全 5 件): evidence-top-to-hand.test.ts:62 `.toBe(false)` / :75 `.toBe(true)`、
  atom-handlers.test.ts:109 `.toBe(true)` / :1058 `.toBe(true)` / :1113 `.toBe(false)`。
- 各 test は `runAtom(draft, …, makeCtx())` (atom-handlers) / `…, ctx())` (evidence factory L37) と **inline 渡し** →
  ctx を変数捕捉する restructure: `const c = makeCtx(); produce(s, d => runAtom(d, …, c)); expect(c.dyn?.chainStepNoApply)…`。
  makeCtx (fixtures.ts) / 局所 ctx() は Immer 非 draft の plain obj ゆえ produce 外で捕捉すれば mutation が残る。
- evidence の module helper `chainFlag = () => globalThis…` (L38) と beforeEach reset (L48) は廃止/再設計
  (chainFlag を捕捉済 c.dyn 参照に置換、reset は ctx 単位 pre-init へ)。
- ⚠ falsy 差: 移設後 未 set は `undefined`。**`.toBe(false)` を読む全 2 件** (evidence:62 §1 実効果あり=書込み無し /
  atom-handlers:1113 fileFlipTop 不発) は捕捉 ctx を `dyn:{chainStepNoApply:false}` で pre-init してから handler 呼出
  → `.toBe(false)` 維持。`.toBe(true)` 3 件は handler が set するため pre-init 任意。
- storage 位置の移設に伴う **同義 assert の移送** であり production 挙動不変。件数不変 (2783)。

## Change B — `__pendingEffectChoiceBindings` を `__pendingEffectChoiceResume` に統合

**pending-state.ts 内部のみ** (export 関数シグネチャ完全不変 → resolve-picks/apply-pick/test 改変ゼロ)。
- 外部 reader 検証: 両 channel の生 globalThis 読みは pending-state.ts のみ (test は comment 言及のみ、生読み無し)。
- 単一 backing は **既存の allowlist 名 `__pendingEffectChoiceResume` を維持**し型のみ
  `Effect|null` → `{effect: Effect|null, bindings: Record<string,unknown>|null}|null` に変更
  (新名は禁: lint regex `__pending[A-Z]…` で新 channel 化→4点配線 check ERROR になるため):
  - `setPendingChoiceResume(eff)` → `(g ??= {effect:null,bindings:null}).effect = eff`
  - `getPendingChoiceResume()` → `g?.effect ?? null` (resolve-picks:447 の rewrap が effect のみ参照、bindings 保持)
  - `setPendingChoiceBindings(b)` → `(g ??= {…}).bindings = b`
  - `_takePendingChoiceResume()` → **null-safe** (review BLOCKER): `const v=g?.effect??null; if(g) g.effect=null; return v`
    (現行 top-level globalThis 読みは `?? null` で null-safe。apply-pick:236 take は :237 `if(!resumeEffect)return` desync
    ガードより **先に** 実行されるため、g=null で `g.effect=null` すると現行の graceful return が TypeError 化する→必ず if(g) ガード)
  - `_takePendingChoiceBindings()` → `const v=g?.bindings??null; if(g) g.bindings=null; return v` (同上 null-safe)
  - `_clearPendingChoiceResume()` → `if(g) g.effect=null` (現状 resume のみ clear と同義。caller ゼロ=memory 17158)
  - `_clearPendingEffectChoiceSide()` → ChoiceSide=null + `__pendingEffectChoiceResume=null` (両 field 一括)
- declare global `var __pendingEffectChoiceBindings` を削除 (Resume は retype で存置)。
- lint-side-channel.ts の `ENGINE_INTERNAL_CHANNELS` から 'EffectChoiceBindings' 行 + コメントを除去
  (channel 消滅で allowlist entry が stale 化。lint は scripts/ なので骨格非該当・編集可)。

## エッジケース (5+)
1. 証拠0/FILE0/候補0 の chain break (core 121/145/257、resolve-picks 276/320) — ctx.dyn 経由で resolver:99 が読む。
2. nested chain (chain in chain) — 同一 ctx 共有で globalThis と同義。
3. choice surface 時 bindings 不在 (top-level B06007、ctx.bindings={}) — `setPendingChoiceBindings({})` で空 obj、統合後も同じ。
4. sequence 内 choice の rewrap (resolve-picks:447-448) — getPendingChoiceResume が effect のみ返す→bindings 温存。
5. _clearPendingChoiceResume caller ゼロ (memory 17158) — 統合後も effect-only clear で意味不変。
6. AI/hirameki 経路 (humanChooser=false) — choice/optional は全 walk、bindings/chain は不変。

## 挙動不変ゲート
tsc0 / full vitest 2783 (移送後も件数維持) / smoke:1000 winsA=498 一致 / e2e 3spec 26 / eslint delta0 (127) / 規約lint8。
決定論検証 (review で 2 指標に分離訂正): (a) `grep -E '^\s*var __' src` で declare-global slot **13→11**
(Change A=__chainStepNoApply / Change B=__pendingEffectChoiceBindings 削除)。(b) `npm run lint:side-channel` の
channels 数 **13→12** (EffectChoiceBindings 消滅のみ。__chainStepNoApply は `__pending` 接頭辞外で lint 元々非計数 →
Change A は lint 数不変)。git diff で touched file が想定集合 (resolver/core/resolve-picks/pending-state/lint-side-channel
+ 2 test) のみ。Change A 個別検証: `grep -rc '__chainStepNoApply' src` が pending-state decl 1 件減 + read/write が ctx.dyn 化。
