# Phase 3e 設計 — useEngineDispatch 続き / exhaustiveness ガード (2026-06-22、着手前フルパネルレビュー反映済)

挙動完全不変 (骨格凍結の「動作不変な内部最適化」例外)。本 phase は **additive (compile-time-only)**。
着手前フルパネル設計レビュー (Workflow opus 4 lens + synthesis、509k tok、**BLOCKER 0**、4/4 lens 一致で minimal)。

## 最終 scope: **minimal** (当初 4 sub-goal のうち #4 のみ採用)

| sub-goal | 処遇 | 理由 |
|----------|------|------|
| 1. runEngineAction 物理分離 | **DROP** | barrel 490 行 < 500 で size 動機ゼロ (数値ターゲット既達)。分割は `_justDeclaredAxId` (produce 境界越え module-let, 8 ref 全て barrel 内) を cross-module shared-mutable 化し BUG-034 category (3d 判定済)。純 risk・便益ゼロ |
| 2. `_justDeclaredAxId` globalThis/accessor 化 | **DROP** | globalThis 化は headline target「declare-global slot ≤7」を 11→12 に逆行 (3c の 13→11 打消し)。barrel module-let KEEP。Option R (closure-local return) は分割不要で可だが 24 return の挙動隣接編集ゆえ不変 phase に不適 |
| 3. EngineAction family 型化 | **DROP (SUBSUMED by #4)** | 効くのは 2 switch のみ (他 20+ consumer は constructor literal で無影響)。full-union default:never が member-drop を全捕捉済 → family は member-misassignment risk だけ追加 (safety net 負) |
| 4. 両 switch に default:never ガード | **ADOPT** | 唯一の真の便益。tsconfig は `noFallthroughCasesInSwitch` 有・**`noImplicitReturns` 無** → member 脱落が silent fall-through する穴を塞ぐ |

## 背景 (silent-gap)

EngineAction を switch する箇所は **2 つだけ**: `runEngineAction` (barrel) と `isAllowed` (can-check.ts)。
両 switch とも現在 **24 discriminant tag を全網羅** (union=24 / runEngineAction=24 / isAllowed=24、タグ数パリティ検証済。
`effectPickResolve` は 1 tag に 5 structural variant を集約 = single case で全網羅)。`noImplicitReturns` 不在のため、
将来 member 追加で case を書き忘れると tsc は無警告で switch を素通りする (silent)。default:never でこれを compile error 化する。

## 実装 (helper 不使用・インライン展開)

repo 既存 8 サイトが全てインライン (`assertNever` 関数 0 件)。戻りが void/false の 2 種で単一 helper に統一不可。

**(a) `src/ui/hooks/useEngineDispatch.ts` runEngineAction (void)** — switch 末尾 (endTurn case の後・switch `}` の直前):
```ts
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return;
    }
```
**(b) `src/ui/hooks/useEngineDispatch/can-check.ts` isAllowed (boolean)** — switch 末尾:
```ts
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return false;
    }
```
- **throw を使わない (MAJOR)**: `isAllowed` は `dispatchEngineAction` の **try 外** (L401) で呼ばれる。throw 系 assertNever だと
  未知 action が uncaught 例外で dispatchEngineAction を貫通し挙動破壊。`runEngineAction` は try 内 (L406 produce) だが
  対称性と「現状の silent-skip / falsy-return を維持」のため両方 void 変種。
- `return false` は現状の implicit `return undefined` (`!isAllowed` 呼出で `!undefined===!false`) と観測等価かつ、宣言済み
  戻り型 `: boolean` の implicit-undefined 漏れを締める additive 改善。default は両 switch とも到達不能 (24/24 網羅) → runtime 完全不変。

## 挙動不変の機械検証 (byte-identity 不可・additive ゆえ numstat で代替)

```bash
# (1) 触ったのは 2 ファイルのみ・deletions=0
git diff --numstat src/ui/hooks/useEngineDispatch.ts src/ui/hooks/useEngineDispatch/can-check.ts   # 第2列=0
# (2) 追加行が default ガードのみ (既存 24 case 未接触)
git diff -U0 ...2ファイル | grep '^+' | grep -vE 'default:|_exhaustive|void |return( false)?;|^\+\s*\}|^\+\s*//|^\+\+\+'  # 空
# (3) guard 有効性の負テスト (commit しない): reasoning case を 1 つ削り tsc が TS2322 で落ちる → 復元
```

## 挙動不変ゲート (right-size。本質ゲート = tsc green = 24/24 網羅の formal proof)

tsc0 / 負テスト TS2322 (commit せず) / full vitest baseline 2783+1skip 一致 / smoke:1000 winsA=498 一致 /
e2e 3 spec (engine-extensions/reuse-cards/task-d-extensions=26) / eslint added0 (baseline 125、`_exhaustive` は
`varsIgnorePattern:"^_"` 免除・default `{}` で no-case-declarations 不発火) / 規約 lint 8 本 / slot 11 据置 / numstat additive-only。

## 水平展開 (CLAUDE.md 義務) → Phase 3f (新設、骨格凍結ゆえ別 phase)

engine 層 `applyMove` (`src/ai/policy.ts:209`、11-member `Move` union を switch、**default 0 件**) が UI と完全同型の
silent-gap を持つ。`cost/pay.ts` コメントが動機に引く bug class の生きた実例。**骨格凍結原則のため本 phase では触らない** —
engine touch 可能 phase or 骨格バグ修正例外として **Phase 3f** に切り出し trace を残す ([phases.md](phases.md) §4 直前)。
