# カード atom コンパクト化 + 規約制定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全 non-partner カード (43枚) の atom 記述を「1ステップ=1行 + comment-above」形に統一し、規約 doc を制定する。土台として engine に全 pick系 verb の短縮形を `ATOM_PICK_SPEC` テーブルで一本化する（動作不変）。

**Architecture:** (1) 規約 doc 2 本を新規作成。(2) engine の短縮形ロジック（現状 `resolve-picks.ts` の PB ブロックと `atom-handlers.ts` の `defaultPickTarget`/PA 分岐に分散）を単一テーブル + `normalizeAtomShortForm()` に集約し、`sceneSetState`/`charModifyLP`/`sceneEnter`(area) と dyn-delta を追加。(3) カードをバッチ B0–B5 で reformat。各変更は **vitest 全件 + tsc + smoke 1000 + descriptor 等価** で動作不変を保証。

**Tech Stack:** TypeScript, Vitest, Immer, tsx (gen-docs), Playwright (MCP), simple-git-hooks。

**設計ソース:** [docs/superpowers/specs/2026-06-02-card-atom-compaction-and-conventions-design.md](../specs/2026-06-02-card-atom-compaction-and-conventions-design.md)

---

## 共通: 検証プロトコル (各 commit 前に実行)

```bash
npx tsc --noEmit                       # 型エラー 0
npx vitest run                         # 全件 PASS (現状 1577+)
npm run smoke -- --games 1000          # 0 例外 (winsA/winsB 出力)
```
- カード reformat は **動作不変**。各カードに既存 test があれば PASS が主オラクル。
- engine refactor は §Phase2 の characterization test が移行前後で不変であること。
- `git commit` は pre-commit hook (`docs:check`) を通す。構造変化があれば `npm run docs:structure` で `.claude/auto/structure.md` を再生成して同 commit に含める。`--no-verify` 禁止。

---

## Phase 1 — 規約 doc 制定

### Task 1.1: card-authoring-convention.md 作成

**Files:** Create `.claude/specs/card-authoring-convention.md` (≤100行)

- [ ] **Step 1: 以下内容で新規作成**

````markdown
# カード実装コーディング規約

公式テキストの動詞列を **1ステップ=1行 atom** に翻訳する。リファレンス: D08013 / D08003 / D11019 / D11020。

## 規則
1. **1ステップ=1行**: `{ kind:'atom', verb, args:{...} },` を1物理行に。`kind`/`verb`/`args` を改行で割らない。
2. **comment-above**: 各ステップの**直前行**に公式テキスト対応句を `//` で置く（末尾コメント禁止）。`conditional` は `if`/`then` で意味が分かれる場合分岐ごとに直前行コメント可。
3. **短縮形優先**: pick を伴う atom は `target:{kind:'pick'}` を書かず `args:{ player, n|max, side?, filter?|filterAny?, state? }` で。`n`=固定 / `max`=0〜max(skip可)。短縮形が効く verb は [engine-api-atom-verbs.md](engine-api-atom-verbs.md) の `ATOM_PICK_SPEC` が権威。
4. **冗長 choice 除去**: 単一 option を pick のためだけに包む `choice→options:[atom]` は短縮形が pick を駆動するので削除。本物の「AかBを選ぶ」分岐のみ `choice` を残す（例: D11012 LP+1/AP+2000）。
5. **condition**: `condition:`(能力ゲート) と `conditional{if,then}`(効果内分岐) は [card-condition-catalog.md](card-condition-catalog.md) の語彙で。`if`/`then` も可能な限り1行。
6. **closure は最終手段**: `continuousModifier` の `apDelta`/`lpDelta` 関数 (D08005) と `kind:'custom'` check (D11013) は atom 化できない正当例。`dyn` 式 (D08007 `$dyn.*`) で代替可能なら優先。
7. **ヘッダ/順序**: ファイル冒頭に「公式テキスト全文 → a1/a2… の1行要約」。`ability` は `a1,a2,…` 連番で `abilities:[...]` 出現順と一致。各 ability に `ruleRefs` 必須。

## 例 (comment-above)
```typescript
steps: [
  // 証拠を1つ得る
  { kind: 'atom', verb: 'evidenceGain',   args: { player: 'self', n: 1 } },
  // 自分の証拠を1つ選び、手札に加える
  { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } },
  // 自分は手札を1枚選びリムーブする
  { kind: 'atom', verb: 'discard',        args: { player: 'self', n: 1 } },
],
```

## チェック
- [ ] 全 atom step が1物理行 + 直前行コメント
- [ ] 短縮形で書ける pick は短縮形（`ATOM_PICK_SPEC` 参照）
- [ ] 冗長 choice 除去 / 真の分岐は保持
- [ ] description・動作・テスト不変（reformat 時）
- [ ] [card-addition-checklist.md](card-addition-checklist.md) も通す
````

- [ ] **Step 2: commit** `git add .claude/specs/card-authoring-convention.md .claude/auto/structure.md && git commit -m "docs(specs): カード実装コーディング規約 (comment-above/1行atom)"`

### Task 1.2: card-condition-catalog.md 作成

**Files:** Create `.claude/specs/card-condition-catalog.md` (≤100行)

- [ ] **Step 1: 以下内容で新規作成**（`Condition` 型は [engine-api-conditions.md](engine-api-conditions.md) が権威。本書は使う側早見表）

````markdown
# condition カタログ (カード実装早見表)

`condition:`(能力ゲート) / `conditional{if}`(効果内分岐) で使う `Condition.kind` の1行スニペット集。型の権威は [engine-api-conditions.md](engine-api-conditions.md)。

## アイコン/文言 → kind
| 公式 | snippet | 例 |
|---|---|---|
| 【自分/相手ターン中】 | `{ kind:'turn', player:'self' }` | D11016 |
| 【パートナー(色)】 | `{ kind:'partnerColor', color:'青' }` | D08003 |
| 【事件(色)】 | `{ kind:'caseColor', color:'青' }` | — |
| 【事件(特徴)】 | `{ kind:'caseTrait', trait:'婚活' }` | D11003(factory) |
| 【FILE(X)】 | `{ kind:'fileAtLeast', n:7 }` | — |
| 【事件編/解決編】 | `{ kind:'caseStatus', status:'解決編' }` | D08019/D08026 |
| 【絆(名)】 | `{ kind:'bond', cardName:'工藤新一' }` | — |
| 現場にXがいる場合 | `{ kind:'sceneHas', query:{area:'scene',side:'self',filter:{trait:'少年探偵団'}}, nMin:1 }` | D08003 |
| 重ね数X以上 | `{ kind:'stackedCountAtLeast', ref:{kind:'self'}, n:3 }` | D08021 |
| リムーブに色X以上 | `{ kind:'removeColorAtLeast', player:'self', color:'黄', n:20 }` | D11019 |
| リムーブに特徴X以上 | `{ kind:'removeTraitAtLeast', player:'self', trait:'神奈川県警', n:3 }` | D11020 |
| bind 有無 | `{ kind:'bound', key:'$matched', presence:'matched' }` | D11019 |
| 論理結合 | `{ kind:'and', cs:[...] }` / `or` / `not` | D11019/D11021 |
| 宣言型独自条件 | `{ kind:'custom', check:(s,ctx)=>... }` (最終手段) | D11013 |

## 使い分け
- 能力全体を ON/OFF → `condition:`（不成立なら rules/17 で「能力を持たない」扱い）。
- 効果列の途中分岐 → `conditional{ if, then, else? }`。`if` には上表の kind を使う。
- 「してもよい/そうした場合」連鎖 → `chain` + step1 `max:1`（skip で break）。

## 新 condition 追加手順
1. `src/engine/cond/eval.ts` に kind 追加 + 評価実装。
2. [engine-api-conditions.md](engine-api-conditions.md) の型に追記。
3. 本カタログに行追加（snippet + 例）。
3点同時更新が必須。
````

- [ ] **Step 2: commit** `git add .claude/specs/card-condition-catalog.md .claude/auto/structure.md && git commit -m "docs(specs): condition カタログ (カード実装早見表)"`

### Task 1.3: 既存 doc から相互リンク

**Files:** Modify `.claude/specs/engine-api-conditions.md`, `engine-api-effect-descriptor.md`, `engine-api-atom-verbs.md`, `card-addition-checklist.md` の「## 関連」節

- [ ] **Step 1:** 各ファイルの関連節に追記:
  - `engine-api-conditions.md` → `- [card-condition-catalog.md](card-condition-catalog.md) — カード実装の早見表`
  - `engine-api-effect-descriptor.md` / `engine-api-atom-verbs.md` → `- [card-authoring-convention.md](card-authoring-convention.md) — 1行atom / comment-above 規約`
  - `card-addition-checklist.md` → 上記2本へのリンク
- [ ] **Step 2: commit** `git add -A .claude/specs && git commit -m "docs(specs): 規約2本への相互リンク追加"`

---

## Phase 2 — engine 短縮形の `ATOM_PICK_SPEC` 一本化 (動作不変 refactor + 新 verb)

**現状の二段フロー（保持すべき不変条件）:**
- 初期 walk (`resolveEffectPicks`): PB verb は target 構築するが push 抑止 (`isPatternB && !_fromAtomHandler`)。PA verb は素通り。
- 実行時 (`runAtom`): PB は `defaultPickTarget` で target 再構築 → `tryRePickFromAtom`。PA は各 case 分岐で `{uid:undefined,player,n|max}` 検出 → `uid:'$pick'`+target 構築 → `tryRePickFromAtom`。`uid:'$pick'` 到達時は skip log。

### Task 2.1: characterization (golden) test を追加

**Files:** Create `tests/engine/effect/short-form-characterization.test.ts`

- [ ] **Step 1: 現挙動を固定する test を書く**（移行前に PASS することを確認 → 移行後も PASS が動作不変の証明）

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { runAtom } from '@/engine/effect/atom-handlers';
import { makeTestState, putChar, putHandCard, ctxFor } from '@/test-utils/state'; // 既存 helper を使用 (無ければ最小 fixture を別途追加)

describe('short-form characterization (動作不変オラクル)', () => {
  beforeEach(() => _clearPendingEffectPickQueue());

  it('PB discard 短縮形 {player,n} は初期walkでpush抑止', () => {
    const s = makeTestState();
    putHandCard(s, 'self', 'D08007');
    const eff = { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } as const;
    resolveEffectPicks(s, eff, ctxFor(s, 'self', 'D08015', 'a1'), { humanChooser: true });
    expect(_peekPendingEffectPickQueueLength()).toBe(0); // 初期walkでは未push
  });

  it('PB discard 短縮形は runtime runAtom で side-channel push', () => {
    const s = makeTestState();
    putHandCard(s, 'self', 'D08007'); putHandCard(s, 'self', 'D08011');
    runAtom(s, 'discard', { player: 'self', n: 1 }, ctxFor(s, 'self', 'D08015', 'a1'));
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('discard');
    expect(side.nMin).toBe(1); expect(side.nMax).toBe(1);
  });

  it('PA sceneRemove 短縮形 {player,max,side,filter} は runtime で scene pick を push', () => {
    const s = makeTestState();
    putChar(s, 'opp', 'D08007'); // AP1000 ≤ 8000
    runAtom(s, 'sceneRemove', { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } }, ctxFor(s, 'self', 'D08003', 'a1'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('sceneRemove');
    expect(side.nMin).toBe(0); expect(side.nMax).toBe(1); // max → min0
  });

  it('PA charModifyAP 短縮形 {delta,max,filter} は scene pick を push', () => {
    const s = makeTestState();
    putChar(s, 'self', 'D08007');
    runAtom(s, 'charModifyAP', { delta: 1000, max: 1, side: 'either', filter: { trait: '少年探偵団' } }, ctxFor(s, 'self', 'D08024', 'a1'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charModifyAP');
    expect(side.nMax).toBe(1);
  });
});
```

- [ ] **Step 2: 移行前に実行して PASS 確認** `npx vitest run tests/engine/effect/short-form-characterization.test.ts`
  Expected: 4 PASS（現挙動を正しく capture できている）。**もし test helper (`makeTestState` 等) が無ければ**、まず既存 test (`tests/engine/effect/bug-077-evidence-to-hand-e2e.test.ts`) の fixture 構築を流用して helper を整える。
- [ ] **Step 3: commit** `git add tests/engine/effect/short-form-characterization.test.ts && git commit -m "test(engine): 短縮形 characterization test (移行前 baseline)"`

### Task 2.2: `ATOM_PICK_SPEC` テーブル導入 (データのみ・挙動不変)

**Files:** Create `src/engine/effect/atom-pick-spec.ts`

- [ ] **Step 1: テーブルと型を定義**

```typescript
// engine.effect.ATOM_PICK_SPEC — pick系 atom 短縮形の唯一の権威ソース。
// 規約 doc (.claude/specs/card-authoring-convention.md 規則3) が本テーブルを参照する。
import type { Player } from '../types/index.js';

export type AtomPickMode = 'PA' | 'PB';
export interface AtomPickSpec {
  /** 既定 pick area。'from' は args.from (sceneEnter) を参照。 */
  defaultArea: 'scene' | 'hand' | 'evidence' | 'remove' | 'from';
  /** PA: uid='$pick' 置換型 (sceneRemove等) / PB: target=cardId配列型 (discard等)。 */
  mode: AtomPickMode;
  /** 短縮形成立に必須の追加 arg。'delta' は number|{dyn}、'state' は文字列。 */
  needs?: 'delta' | 'state';
  /** remove/evidence 等の source area から実体を抜く必要がある verb。 */
  sourceSplice?: boolean;
}

export const ATOM_PICK_SPEC: Record<string, AtomPickSpec> = {
  // 既存 (移行対象)
  discard:           { defaultArea: 'hand',     mode: 'PB' },
  evidenceToHand:    { defaultArea: 'evidence', mode: 'PB' },
  handAddFromRemove: { defaultArea: 'remove',   mode: 'PB', sourceSplice: true },
  sceneRemove:       { defaultArea: 'scene',    mode: 'PA' },
  charModifyAP:      { defaultArea: 'scene',    mode: 'PA', needs: 'delta' },
  // 新規
  sceneSetState:     { defaultArea: 'scene',    mode: 'PA', needs: 'state' },
  charModifyLP:      { defaultArea: 'scene',    mode: 'PA', needs: 'delta' },
  sceneEnter:        { defaultArea: 'from',     mode: 'PA', sourceSplice: true },
};

/** delta が number か {dyn:string} かを判定 (dyn-delta 短縮形対応)。 */
export function isShortFormDelta(v: unknown): boolean {
  return typeof v === 'number' || (typeof v === 'object' && v !== null && typeof (v as { dyn?: unknown }).dyn === 'string');
}
```

- [ ] **Step 2: typecheck** `npx tsc --noEmit` Expected: PASS（未使用 export 警告は出ない設定）。
- [ ] **Step 3: commit** `git add src/engine/effect/atom-pick-spec.ts && git commit -m "feat(engine): ATOM_PICK_SPEC テーブル導入 (短縮形権威ソース)"`

### Task 2.3: `normalizeAtomShortForm()` 実装 + PA/PB 既存経路を移行

**Files:** Modify `src/engine/effect/resolve-picks.ts` (PB block 216-264), `src/engine/effect/atom-handlers.ts` (`defaultPickTarget` 185-208 + `sceneRemove` 504-528 + `charModifyAP` 567-587 の短縮形分岐)

- [ ] **Step 1: `atom-pick-spec.ts` に normalizer を追加**（PA/PB 双方の target を構築。現 `defaultPickTarget`(PB) と `sceneRemove`/`charModifyAP`(PA) の target 構築を1関数に統合した契約）

```typescript
// 短縮形 args → pick target を構築。成立しなければ undefined。
// PB: { player, n|max, filter? } / PA: { player|delta|state, n|max, side?, filter?, state?, from? }
export function normalizeAtomShortForm(
  verb: string,
  a: Record<string, unknown>,
  fallbackPlayer: Player,
): { uid?: '$pick'; target: unknown } | undefined {
  const spec = ATOM_PICK_SPEC[verb];
  if (!spec) return undefined;
  if (a.target !== undefined) return undefined;              // 明示 target 優先
  const hasN = typeof a.n === 'number';
  const hasMax = typeof a.max === 'number';
  if (!hasN && !hasMax) return undefined;
  if (spec.needs === 'delta' && !isShortFormDelta(a.delta)) return undefined;
  if (spec.needs === 'state' && typeof a.state !== 'string') return undefined;
  const player = (a.player as Player) ?? fallbackPlayer;
  const side = (a.side as 'self' | 'opp' | 'either' | undefined)
    ?? (spec.mode === 'PA' ? (verb === 'sceneEnter' ? player : 'either') : player);
  const area = spec.defaultArea === 'from' ? ((a.from as string) ?? 'remove') : spec.defaultArea;
  const nMin = hasN ? (a.n as number) : 0;
  const nMax = hasN ? (a.n as number) : (a.max as number);
  const query: Record<string, unknown> = { area, side };
  if (a.filter && typeof a.filter === 'object') query.filter = a.filter;
  if (a.filterAny && Array.isArray(a.filterAny)) query.filterAny = a.filterAny;
  if (Array.isArray(a.state)) query.state = a.state;          // 状態フィルタ (TargetQuery.state)
  if (a.distinctNames === true) query.distinctNames = true;
  const target = { kind: 'pick' as const, query, n: { min: nMin, max: nMax }, chooser: player };
  return spec.mode === 'PA' ? { uid: '$pick', target } : { target };
}
```
  注: `needs:'state'` は **top-level `a.state` が文字列**（setState の状態値）。pick の状態フィルタは別物で `Array.isArray(a.state)` の時に `query.state` へ。sceneSetState では setState 値が文字列で来るため `query.state` には入らない。

- [ ] **Step 2: `resolve-picks.ts` の PB short-form block (216-264) を normalizer 呼び出しに置換**。`PB_DEFAULT_PICK_AREA` を削除し、`substituteAtomPick` 冒頭の `effectiveTarget` 構築を:
```typescript
  let effectiveTarget = args.target as { kind?: string; query?: unknown; n?: { min?: number; max?: number }; chooser?: Player } | undefined;
  if (effectiveTarget === undefined) {
    const norm = normalizeAtomShortForm(verbStr, args, (args.player as Player) ?? 'self');
    if (norm && ATOM_PICK_SPEC[verbStr]?.mode === 'PB') effectiveTarget = norm.target as typeof effectiveTarget;
  }
```
  （PA は従来どおり初期 walk では target 構築せず素通り → 実行時 atom-handler が処理）

- [ ] **Step 3: `atom-handlers.ts` の `discard`/`evidenceToHand`/`handAddFromRemove` の `defaultPickTarget(...)` 呼び出しを `normalizeAtomShortForm(verb, a, dcP)?.target ?? a.target` に置換**。`defaultPickTarget` 関数は削除。

- [ ] **Step 4: `sceneRemove`(504) と `charModifyAP`(567) の短縮形分岐 (`if (a.uid===undefined && ...)`) を共通ヘルパに置換:**
```typescript
      // PA 短縮形: normalizer で uid='$pick'+target を構築し tryRePickFromAtom
      const sf = (a.uid === undefined) ? normalizeAtomShortForm(verb, a, resolvePlayer(a.player, ctx)) : undefined;
      if (sf) {
        const paArgs = { ...a, uid: sf.uid, target: sf.target };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: resolvePlayer(a.player ?? ctx.source.player, ctx), source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: resolvePlayer(a.player ?? ctx.source.player, ctx), turn: s.turn.number, action: `effect:${verb}:awaiting-pick` });
        return;
      }
```
  （`charModifyAP` は `a.player` が無く `ctx.source.player` 基準だった点に注意 — `resolvePlayer(a.player ?? ctx.source.player, ctx)` で両対応。既存 byPlayer の値が変わらないこと characterization test で確認）

- [ ] **Step 5: characterization + 全件実行** `npx vitest run` → 4件 + 全既存 PASS。`npx tsc --noEmit` PASS。`npm run smoke -- --games 1000` 0 例外。
- [ ] **Step 6: commit** `git add -A src/engine/effect && git commit -m "refactor(engine): 短縮形を ATOM_PICK_SPEC + normalizeAtomShortForm に一本化 (動作不変)"`

### Task 2.4: `sceneSetState` 短縮形 (新規 PA verb)

**Files:** Modify `src/engine/effect/atom-handlers.ts` (`sceneSetState` case 542)、Test `tests/engine/effect/short-form-new-verbs.test.ts`

- [ ] **Step 1: 失敗する test を書く**
```typescript
it('sceneSetState 短縮形 {player,max,side,state} で scene pick を push', () => {
  const s = makeTestState(); putChar(s, 'either' as never, 'D08007'); putChar(s, 'self', 'D08011');
  runAtom(s, 'sceneSetState', { player: 'self', max: 1, side: 'either', state: 'sleep' }, ctxFor(s, 'self', 'D08019', 'a1'));
  const side = _drainPendingEffectPickSide()!;
  expect(side.atomVerb).toBe('sceneSetState'); expect(side.nMax).toBe(1);
});
```
- [ ] **Step 2: 実行して FAIL 確認** `npx vitest run tests/engine/effect/short-form-new-verbs.test.ts -t sceneSetState` Expected: FAIL (push 0 件)。
- [ ] **Step 3: `sceneSetState` case 冒頭に Task2.3 Step4 の PA 短縮形ブロックを追加**（`uid:'$pick'` skip log 分岐も追加: `if (a.uid==='$pick'){ log skipped; return; }`）。
- [ ] **Step 4: PASS 確認** `npx vitest run tests/engine/effect/short-form-new-verbs.test.ts` Expected: PASS。
- [ ] **Step 5: commit** `git add -A src/engine/effect tests/engine/effect && git commit -m "feat(engine): sceneSetState 短縮形 (D08019/D11003/D11009)"`

### Task 2.5: `charModifyLP` 短縮形 (新規 PA verb)

**Files:** Modify `atom-handlers.ts` (`charModifyLP` case 602)、Test 同上

- [ ] **Step 1: 失敗する test**
```typescript
it('charModifyLP 短縮形 {delta,max,side,filter} で scene pick を push', () => {
  const s = makeTestState(); putChar(s, 'self', 'D11012');
  runAtom(s, 'charModifyLP', { delta: 1, max: 1, side: 'self', filter: { trait: '警察', lpMax: 0 } }, ctxFor(s, 'self', 'D11012', 'a1'));
  const side = _drainPendingEffectPickSide()!;
  expect(side.atomVerb).toBe('charModifyLP'); expect(side.nMax).toBe(1);
});
```
- [ ] **Step 2: FAIL 確認** `npx vitest run ... -t charModifyLP`
- [ ] **Step 3: `charModifyLP` case 冒頭に PA 短縮形ブロック + `$pick` skip log を追加**（`charModifyAP` と同型）。
- [ ] **Step 4: PASS 確認**
- [ ] **Step 5: commit** `git commit -am "feat(engine): charModifyLP 短縮形 (D11012)"`

### Task 2.6: `sceneEnter` area 短縮形 + `filterAny` (新規)

**Files:** Modify `atom-handlers.ts` (`sceneEnter` case 381 — 既に `$pick.cardId`+target 経路あり)、Test 同上

- [ ] **Step 1: 失敗する test**
```typescript
it('sceneEnter 短縮形 {player,from,max,filterAny} で remove pick を push', () => {
  const s = makeTestState(); putRemove(s, 'self', 'D08019'); // 少年探偵団 Lv5
  runAtom(s, 'sceneEnter', { player: 'self', from: 'remove', max: 1, filterAny: [{ cardName: '阿笠博士', levelMax: 5 }, { trait: '少年探偵団', levelMax: 5 }] }, ctxFor(s, 'self', 'D08024', 'a1'));
  const side = _drainPendingEffectPickSide()!;
  expect(side.atomVerb).toBe('sceneEnter'); expect(side.nMax).toBe(1);
});
```
- [ ] **Step 2: FAIL 確認**
- [ ] **Step 3: `sceneEnter` case で `cardId` 未指定 + 短縮形成立時に `normalizeAtomShortForm` で `cardId:'$pick.cardId'`+target を構築 → 既存 `$pick.cardId` 経路 (387-405) に合流**。`sourceSplice` は既存の source area splice (411-) が `a.target.query.area` を見るので target 構築で機能。
- [ ] **Step 4: PASS 確認**
- [ ] **Step 5: commit** `git commit -am "feat(engine): sceneEnter area短縮形 + filterAny (D08024/D11014)"`

### Task 2.7: dyn-delta 短縮形 (charModifyAP/LP が `delta:{dyn}` を受理)

**Files:** Test 同上（Task2.2 で `isShortFormDelta` 済 → 分岐条件確認）

- [ ] **Step 1: 失敗 or 確認 test**
```typescript
it('charModifyAP 短縮形が delta:{dyn} を受理 (D08026/D11021)', () => {
  const s = makeTestState(); putChar(s, 'self', 'D08007');
  runAtom(s, 'charModifyAP', { delta: { dyn: '$cost.flipFaceUpEvidence.count * 1000' }, max: 1, side: 'self', filter: { trait: '少年探偵団' } }, ctxFor(s, 'self', 'D08026', 'a2'));
  expect(_peekPendingEffectPickQueueLength()).toBe(1);
});
```
- [ ] **Step 2:** 既存 PA 分岐が `typeof a.delta === 'number'` でハードコードしていれば `isShortFormDelta(a.delta)` に置換（normalizer 内は対応済なので分岐ガードのみ修正）。
- [ ] **Step 3: PASS + 全件 + smoke** `npx vitest run && npx tsc --noEmit && npm run smoke -- --games 1000`
- [ ] **Step 4: commit** `git commit -am "feat(engine): charModifyAP/LP 短縮形が dyn-delta を受理"`

---

## Phase 3 — カード reformat (バッチ B0–B5)

**共通レシピ (各カードに適用):**
1. 各 ability の `effect` を [card-authoring-convention.md] の形へ: atom を1物理行化、直前行に公式テキスト対応コメント、末尾コメント削除。
2. 冗長 `choice→options:[atom]` を除去し短縮形へ（`ATOM_PICK_SPEC` 対象 verb）。真の分岐 choice は保持。
3. `description` は**変更しない**。`ruleRefs`・ヘッダの公式テキストは保持（必要なら整形のみ）。
4. **検証**: 当該カード test PASS（無ければ descriptor 等価 test を追加, 下記 Task 3.0）+ `npx tsc --noEmit` + `npx vitest run`。動作・description 不変。

### Task 3.0: descriptor 等価ヘルパ (test 無しカード用)

**Files:** Create `tests/cards/_helpers/descriptor-equiv.ts`

- [ ] **Step 1:** reformat 前の `effect` を JSON 化して baseline 保存 → reformat 後に `engine.effect.validate` PASS かつ「短縮形展開後の pick query が baseline と等価」を assert するヘルパを実装。
```typescript
import { engine } from '@/engine';
// baseline: reformat 前にカードを import し JSON.stringify(ability.effect) を __snapshots__ に保存。
// 検証: 後で normalizeAtomShortForm 展開した target が baseline の target と deep-equal。
export function expectEffectEquivalent(before: unknown, after: unknown) { /* 展開→deep equal */ }
```
- [ ] **Step 2: commit** `git commit -am "test(cards): descriptor 等価ヘルパ"`

### Task 3.1: B0 — リファレンス9枚 + D11020 を comment-above 化

**Files:** Modify `src/cards/ct-d08/D08003,07,11,13,15,21,26.ts`, `src/cards/ct-d11/D11007,19,20.ts`

- [ ] **Step 1:** 各ファイルの末尾コメントを直前行へ移動（**コメント位置のみ**。atom 構造・動作・description 不変）。例 D08013:
```typescript
    steps: [
      // 証拠を1つ得る
      { kind: 'atom', verb: 'evidenceGain',   args: { player: 'self', n: 1 } },
      // 自分の証拠を1つ選び、手札に加える
      { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } },
      // 自分は手札を1枚選びリムーブする
      { kind: 'atom', verb: 'discard',        args: { player: 'self', n: 1 } },
    ],
```
- [ ] **Step 2:** 各カードの既存 test を実行 PASS（`npx vitest run tests/cards/ct-d08/D08013.test.ts` 等）。`npx tsc --noEmit`。
- [ ] **Step 3: commit** `git commit -am "style(cards): B0 リファレンス9枚+D11020 を comment-above 化 (動作不変)"`

### Task 3.2: B1 — 既存短縮形/comment-above のみ (D11016, D11013, D11005, D11015)

**Files:** Modify `src/cards/ct-d11/D11016,13,05,15.ts`

- [ ] **Step 1:** 個別変換（新 engine 不要）:
  - **D11016**: 2行 atom (`sceneSetState` $self / `charModifyAP` $self) を1行化 + comment-above。pick 無しなので短縮形不要。
  - **D11013**: atom は1行化済 → comment-above 化。`kind:'custom'` check は規約6で保持。
  - **D11005**: `sceneRemove` を choice 除去 + 短縮形 `{player,max,side,filter}` へ。`charSetTurnEffect`($self) は1行化。
  - **D11015**: `charModifyAP` choice 除去 + 短縮形へ。`charGrantKeyword`($self) + conditional は1行化 + comment-above。
- [ ] **Step 2:** 各 test + 等価ヘルパ + `tsc` + `vitest run` PASS。
- [ ] **Step 3: commit** `git commit -am "refactor(cards): B1 D11016/13/05/15 を1行atom+comment-above化 (動作不変)"`

### Task 3.3: B2 — `sceneSetState` 短縮形 (D08019, D11003, D11009)

**Files:** Modify `src/cards/ct-d08/D08019.ts`, `src/cards/ct-d11/D11003,09.ts`

- [ ] **Step 1:** `choice→options:[{atom sceneSetState target:{pick}}]` を短縮形へ。例 D08019 a1 then:
```typescript
    // 自分の現場に[少年探偵団]がいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '少年探偵団' } }, nMin: 1 },
    // キャラを1枚までスリープさせる
    then: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
```
  D11003: a2 `sceneRemove`(既存短縮形) + a3 `sceneSetState` active 短縮形。D11009: `sceneSetState` 短縮形。
- [ ] **Step 2:** test + 等価 + `tsc` + `vitest run` PASS。
- [ ] **Step 3: commit** `git commit -am "refactor(cards): B2 D08019/D11003/D11009 を sceneSetState短縮形化 (動作不変)"`

### Task 3.4: B3 — `charModifyLP` + dyn-delta (D11012, D11021)

**Files:** Modify `src/cards/ct-d11/D11012,21.ts`

- [ ] **Step 1:**
  - **D11012 a1**: 外側 `choice`(LP+1 / AP+2000 の**真の分岐**) は保持。各 option 内の `choice→atom target` を短縮形 `charModifyLP`/`charModifyAP {delta,max,side,filter}` へ。
  - **D11021 a2**: `charModifyAP` を dyn-delta 短縮形 `{ delta:{dyn:'$cost.flipFaceUpEvidence.count * -1000'}, max:1, side:'either' }` へ。`condition` の `and(caseStatus, sceneHas 神奈川県警)` は保持。a1 は comment-above。
- [ ] **Step 2:** test + 等価 + `tsc` + `vitest run` PASS。
- [ ] **Step 3: commit** `git commit -am "refactor(cards): B3 D11012/D11021 を charModifyLP/dyn-delta短縮形化 (動作不変)"`

### Task 3.5: B4 — `sceneEnter` area 短縮形 + filterAny (D08024, D11014)

**Files:** Modify `src/cards/ct-d08/D08024.ts`, `src/cards/ct-d11/D11014.ts`

- [ ] **Step 1:**
  - **D08024 a1**: step1 `choice→sceneEnter(remove,filterAny)` を `{ player:'self', from:'remove', max:1, filterAny:[{cardName:'阿笠博士',levelMax:5},{trait:'少年探偵団',levelMax:5}] }` へ。step2 `charModifyAP` 短縮形へ。a2 `hiramekiDraw` factory は不変。
  - **D11014**: a1 `charModifyAP` 短縮形 + a2 `discard`(済) + `choice→sceneEnter(remove,filter)` を `{player:'self',from:'remove',max:1,filter:{trait:'警察',levelMax:5}}` へ + conditional draw。
- [ ] **Step 2:** test + 等価 + `tsc` + `vitest run` PASS。
- [ ] **Step 3: commit** `git commit -am "refactor(cards): B4 D08024/D11014 を sceneEnter短縮形+filterAny化 (動作不変)"`

### Task 3.6: B5 — 簡易カード comment-above 点検 (D08009,17,22,23,25 / D11011,17,18)

**Files:** Modify 上記8ファイル

- [ ] **Step 1:** 各カードを開き、atom が複数行なら1行化 + 末尾→直前行コメント化。多くは差分小 or 無し（差分無しなら commit 対象外）。`continuousModifier`/factory はそのまま。
- [ ] **Step 2:** `npx tsc --noEmit` + `npx vitest run` PASS。
- [ ] **Step 3: commit** `git commit -am "style(cards): B5 簡易8枚 comment-above 点検 (動作不変)"`

---

## Phase 4 — 最終検証 + 水平展開 + 記録

### Task 4.1: 全件 + smoke + Playwright 実機

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npm run smoke -- --games 1000`（0 例外 / 全 PASS）。
- [ ] **Step 2: Playwright 実機**（CLAUDE.md「画面表示≠機能確認」）: 影響大カードを人間 vs CPU で操作し modal→pick→解決を確認:
  - D08024（リムーブから filterAny 登場 + AP+2000 modal）
  - D11012（LP+1/AP+2000 の真の分岐 choice）
  - D08019（解決編 登場時 sceneSetState 短縮形）
  各 step で console error 0。
- [ ] **Step 3:** 異常時は §systematic-debugging。修正は該当 Task に戻す。

### Task 4.2: 水平展開調査 (CLAUDE.md 必須)

- [ ] **Step 1:** `ATOM_PICK_SPEC` の各 verb を grep し、短縮形に移行できる残存 `target:{kind:'pick'}` がカードに無いか全数確認。`rg "kind: 'pick'" src/cards` の結果が「真の分岐/distinctNames/複雑 query のみ」になっていること。
- [ ] **Step 2:** 結果を `.claude/memory.md` に記録。

### Task 4.3: bug 管理 + docs 再生成 + changelog

- [ ] **Step 1:** reformat 中に発見した動作差異があれば `.claude/bugs/BUG-XXX.md` 作成（無ければその旨記録）。
- [ ] **Step 2:** `npm run docs`（structure/mapping 等 再生成）→ 差分を commit。
- [ ] **Step 3:** `.claude/changelog-entries/2026-06-02-01-card-atom-compaction.md` 作成 → `npm run docs:changelog`。
- [ ] **Step 4: commit** `git commit -am "docs: 規約制定 + atom コンパクト化 完了 (changelog/auto再生成)"`

---

## Self-Review 結果
- **Spec coverage:** §1 scope→Phase3 全 batch / §2 convention→Task1.1 / §3 catalog→Task1.2 / §4 engine→Phase2 / §5 batch→Phase3 / §6 verify→共通+Task4.1 / §7 risk→各 Task の検証 + Task4.2。全項目に対応 Task あり。
- **Placeholder scan:** engine 実装は characterization/新 verb test が spec。card batch は convention doc + 等価ヘルパが recipe。"多くは差分小" は見積りで作業手順は明記済。
- **Type consistency:** `ATOM_PICK_SPEC` / `AtomPickSpec` / `normalizeAtomShortForm` / `isShortFormDelta` / `expectEffectEquivalent` を全 Task で一貫使用。
