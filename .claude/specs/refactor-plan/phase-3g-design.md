# Phase 3g 設計 — resolve-picks chain-case exhaustiveness ガード (2026-06-22、着手前設計レビュー反映済)

挙動完全不変 (骨格凍結の「動作不変な内部最適化」例外)。3f の水平展開で発見した engine 層 silent-gap を、
骨格 touch ゆえ **別 phase** として実施。着手前設計レビュー (Workflow opus 3 lens + synthesis、403k tok、**BLOCKER 0**、**GO**)。
**3f と異なり additive ではない** (default アーム再構成) — 挙動不変は byte-identity でなく実行差分で担保する。

## 対象

`src/engine/effect/resolve-picks.ts:431` の `resolveEffectPicks` 内 `switch (effect.kind)` (Effect union =
`src/engine/types/effect.ts:227-241` の **11 member**)。8 member (atom/sequence/parallel/choice/optional/conditional/
forEach/replace) は個別 case で walk、残り `case 'negate': case 'custom': default: return effect` (L560-563)。
→ `chain` は case を持たず **default の passthrough** に落ち un-walked。tsconfig `noImplicitReturns` 無のため member
脱落が compile error 化されない (3e/3f と同型の silent-gap)。guarded sibling `resolver.ts:78` は chain を handle。

## 実装 (return 変種・default アーム再構成)

L560-563 を置換:
```ts
    case 'chain':
    case 'negate':
    case 'custom':
      return effect;        // pre-walk passthrough (un-walked, 参照同一)
    default: {
      const _exhaustive: never = effect;
      void _exhaustive;
      return effect;
    }
```
- **chain を明示 passthrough にする (walk しない)**: chain の step 内 atom `$pick` は **dispatch 時** に解決される
  (`resolver.ts:78` chain case → `run(step)` → atom-handler `tryRePickFromAtom`)。pre-walk 不要ゆえ passthrough で drop なし。
  negate/custom は walk 対象の sub-effect を持たない。→ 3 member とも現 default と同一 (参照同一) の `effect` を返す = runtime 不変。
- **throw ではなく return 変種** (MAJOR): `resolveEffectPicks` は `applyMove`→`declared-ability.ts:199` 経由で
  `produce()` **try 外** (`ai/policy.ts:419-423`) から到達。throw だと将来 member 脱落で default 到達可能化した瞬間
  stepTurn を貫通 (Phase 3e/3f と同判断)。sibling `resolver.ts:174` が throw なのは run() が **dispatch sink** で
  未処理 kind=実バグ (loud fail) ゆえの正当な非対称。
- **Option B (chain を walk して救済) は非採用**: 現出荷カードに「chain step が choice/optional」は 0 件 (下記)。
  将来そのカードが出たら sequence と同様の walk が必要になる latent 事項 (BUG-152 に記録、活性バグ無で status 据置)。

## 設計レビュー判定 (opus 3 lens + synthesis、403k tok)

| lens | verdict | 要点 |
|------|---------|------|
| invariance (敵対) | invariant | passthrough に落ちる member = {chain,negate,custom} のみ (他 8 は walk して各々 return、fall-through 無)。明示 case は現 default と参照同一の effect 返却。パッチ適用→tsc0/vitest 2783+1skip/AI-vs-AI smoke 0fail→ファイル復元 (git diff empty) で empirical 実証 |
| 骨格凍結+guard変種 | fits / return | 例外「動作不変な内部最適化」に該当。return 変種が正 (produce try 外到達、Phase 3e/3f 同判断)。run=throw / pre-walk=return の非対称は内部整合 |
| 活性バグ (grounding) | none | ALL_CARDS 1374 枚を実コンパイル済 object-walk: chain node 126 個。step-kind signature = atom系のみ、**chain step が choice/optional = subtree 含め 0 件**。chain step の atom $pick は dispatch handler awaiting-pick で surface。B02068/B04023 は optional が chain を wrap (step でない)。→ passthrough で drop なし・Option B 不要 |

## 挙動不変ゲート (全 GREEN)

tsc **0** (両 tsconfig) / **負テスト** (`case 'chain'` 削除→`TS2322 at resolve-picks.ts(574,13)`「Type '{ kind: "chain"; … }'
is not assignable to type 'never'」→復元) / vitest **2783+1skip** (baseline 一致) / smoke:1000 **winsA=498**
(baseline check OK・timeouts0/exceptions0/avg10.998) / e2e 3spec **26** / eslint **125** (added0、`void _exhaustive` で
no-unused-vars 不発火) / 規約 lint 8 本 errors=0 / numstat **16add/1del** (**additive でなく default アーム再構成**ゆえ
numstat だけでは挙動不変を保証できない → tsc の never 受理 [=11member 全網羅の compile 証明] + vitest/smoke/e2e の実行差分で担保)。

## 関連
- [BUG-152](../../bugs/BUG-152.md) (chain pre-walk gap、活性バグ無で latent 化)
- [phase-3f-design.md](phase-3f-design.md) (本 gap の発見元・applyMove ガード)
- sibling: `src/engine/effect/resolver.ts:78` (chain handle) / `:174` (default throw)
