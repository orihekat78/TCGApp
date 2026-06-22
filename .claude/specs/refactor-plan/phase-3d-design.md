# Phase 3d 設計 — UI hooks 分割 (2026-06-22、着手前レビュー反映済)

挙動完全不変 (骨格凍結の「動作不変な内部最適化」例外)。**全変更 100% byte-identity** (3a/3b 型、
関数 body は 1byte も改変せず移送)。決定論 codemod + 独立 HEAD verifier + 着手前フルパネル設計レビュー。
**1 commit に 2 ファイル分割を同梱** (ユーザー選択 2026-06-22)。

barrel 規約は 3a (`atom-handlers/` dir + 同名 barrel が public API 再 export) を踏襲。サブファイルは
**ディレクトリ** に置く: `src/ui/hooks/useActionsPanelFlow/` と `src/ui/hooks/useEngineDispatch/`。
旧 file path (`useActionsPanelFlow.ts` / `useEngineDispatch.ts`) を barrel/core として残し、**importer 改変 0**。

## 着手前フルパネルレビュー反映 (Workflow opus 4 lens + critic, 690k tok, BLOCKER 0)

- **scope 縮小 (SCOPE/critic MAJOR 反映)**: 計画の useEngineDispatch は「29 case 分割 + action union 型化」だが、
  ① runEngineAction を別 module へ分離すると `_justDeclaredAxId` (produce 境界越え module-let) が **cross-module
  shared-mutable** 化し、BUG-034 が globalThis 化で回避した category に該当 (accessor 化は INVARIANCE で挙動不変と
  実証されたが「脆い」) ② EngineAction の family 型化は両 switch に `default:never` ガードが無く tsconfig
  `noImplicitReturns` 不在のため member 脱落を tsc が捕捉できない (silent 挙動変化リスク)。→ **両者を本 phase から外し、
  新 Phase 3e (switch 側 exhaustiveness ガード追加とセットで設計) へ繰り延べ**。本 phase の useEngineDispatch は
  **isAllowed + 型を抽出し runEngineAction/_justDeclaredAxId は barrel に同居 (KEEP)** に純化 → 挙動書換えゼロ。
- **検証ゲート格上げ (critic MAJOR 反映)**: 移送 body の md5 比較に加え、**git HEAD 原本から sub-file + barrel を
  再構築し HEAD と diff=空 (EOL 正規化後)** を確認する独立 verifier を必須化 (3b 基準)。codemod 自身の self-check と別工程。
- **JSDoc 同伴 (NIT 反映)**: codemod は各シンボルを**直上の連続コメントブロック込み**で移送 (3a/3b と同様)。
- **surface 担保の明文化 (SURFACE MINOR 反映)**: tsc は src importer のみ検査 (tests は include 外)。test importer の
  barrel 再 export 配線は **full vitest 2783 pass** が担保。両方を surface 不変ゲートとする。

## 公開 surface (壊してはならない、全 src+tests grep 済)

- **useActionsPanelFlow** 外部 import 17: ACTION_CASE_TARGET_OPP / canAssistForUi / canSolveCaseForUi /
  choiceOptionLabel / enumActionSourceCandidates / enumActionTargetCandidates / enumDeclaredAbilitySources /
  enumReasoningCandidates / run* 9 本。現状 export 済だが外部未使用: enumPartnerAbilityIds / enumDeclaredAbilityIdsFor /
  FlowResult型 → barrel 再 export 維持 (additive)。現状 file-private (export 無): costToText / findFlipFaceUpCost /
  makeAbilityCtx / Player型 / FlipFaceUpCost型 → sub-file で export 昇格 (barrel 非公開、外部 import 0 件で安全)。
- **useEngineDispatch** 外部 import 5: dispatchEngineAction / surfacePendingSideChannels / useEngineDispatch /
  type ContactChoice / type DispatchResult。EngineAction型は外部未 import だが barrel 再 export 維持。
- importer = Playmat.tsx (両方) + driver/modal host + 約 30 test。barrel 再 export で全て無改変。isolatedModules:true →
  type 再 export は `export type` 必須。

## Part A — useActionsPanelFlow 分割 (100% byte-identity)

依存グラフ cost(leaf) ← enumerators ← flows ← barrel (循環なし)。preamble import のみ各ファイルで再構成
(tsconfig noUnusedLocals/Params が過不足を即 fail)。

| 新ファイル | 中身 (現行行、JSDoc 同伴で移送) | 依存 import |
|---|---|---|
| `useActionsPanelFlow/cost.ts` | Player型(116) / choiceOptionLabel(32,export済) / costToText(47) / FlipFaceUpCost型+findFlipFaceUpCost(81) / makeAbilityCtx(97)。private 4 つ export 昇格 | `type {Cost,Effect,EffectCtx}` |
| `useActionsPanelFlow/enumerators.ts` | ACTION_CASE_TARGET_OPP(621) / enumReasoningCandidates(148) / enumPartnerAbilityIds(289) / enumDeclaredAbilitySources(379) / enumDeclaredAbilityIdsFor(436) / enumActionSourceCandidates(627) / enumActionTargetCandidates(648) / canAssistForUi(815) / canSolveCaseForUi(829) | `* as flow`,`engine`, cost.ts の {Player,makeAbilityCtx}。GameState は body 内 inline `import(...).GameState` で自己完結 (top-level import 不要) |
| `useActionsPanelFlow/flows.ts` | FlowResult型(119) / run* 9 本 (EndTurn/Reasoning/NextHint/PartnerAbility/DeclaredAbility/Action/HandUse/Assist/SolveCase) | `* as flow`,`engine`,store,dispatchEngineAction+type DispatchResult, picker hook 群(Confirmation/TargetPicker/NextHintPicker+NextHintCandidate/SceneSwitchPickerStore/EvidenceFlipPicker/ChoicePicker), readDef, uidNames, type AbilityCostParams, cost.ts {Player,costToText,findFlipFaceUpCost,choiceOptionLabel}, enumerators.ts 全 enum/can/CASE定数, `type {Cost,Effect}` |
| `useActionsPanelFlow.ts` (barrel) | 公開 17 + additive 3 (enumPartnerAbilityIds/enumDeclaredAbilityIdsFor/FlowResult) を再 export | — |

flows.ts → useEngineDispatch barrel は片方向 import (逆依存なし) → 循環なし。flows.ts が最大 (~580行、原 909 内)。

## Part B — useEngineDispatch 分割 (100% byte-identity、runEngineAction/_justDeclaredAxId は KEEP)

| 新ファイル | 中身 (現行行) | 依存 import |
|---|---|---|
| `useEngineDispatch/types.ts` | Player(35) / ContactChoice(49) / EngineAction(54-105, **verbatim**) / DispatchResult(107) | — (純型、engine 型不要) |
| `useEngineDispatch/can-check.ts` | isAllowed(125-235) 29-case switch (pure, body 無改変) | `* as flow`, useGameStateStore, _getResolutionLock, `type {GameState}`, `type {EngineAction}` from ./types.js |
| `useEngineDispatch.ts` (barrel/core) | runEngineAction(239-533) + `_justDeclaredAxId`(118, **module-let のまま不変**) + surfacePendingSideChannels(552) + dispatchEngineAction(584) + useEngineDispatch hook(675) + types 再 export | 既存 import 全部 (produce/mutate/_drainPending*/applyPick*/resolveEffectPicks 等) + isAllowed from ./can-check.js + types from ./types.js |

`_justDeclaredAxId` は writer(runEngineAction) と reader(dispatchEngineAction) が **同一 barrel に同居** → cross-module
shared-mutable 化せず、現行と完全に同一の module-let。drain 系 (_drainPending*) も barrel 専属で boundary 不変。

## エッジケース (5+)
1. file-private 5 シンボルの export 昇格: 外部 import 0 件 (grep 済) → barrel 公開を広げない (3b 方針)。
2. circular import: flows.ts→useEngineDispatch は片方向。cost(leaf)←enum←flows も非循環。tsc/vite が循環検知。
3. noUnusedLocals: 各 sub-file preamble は使用 import のみ (3a の per-file 分配 MAJOR 踏襲)。tsc が過不足を即 fail。
4. JSDoc/コメント: 各シンボル直上の連続コメントを body と一体で移送 (choiceOptionLabel 27-31 / makeAbilityCtx 94-96 等)。
5. test importer: 全て barrel path のまま → import 文無改変。tsc は tests 非対象 → vitest 実走が test surface を担保。
6. EOL: working tree=CRLF / git=LF (3a/3b 教訓) → 独立 verifier は EOL 正規化後に HEAD と md5/diff 比較。

## 挙動不変ゲート (この順)
tsc0 / full vitest 2783 pass+1skip (baseline 維持) / smoke:1000 winsA=498 一致 / e2e 3spec 26 /
eslint stash-diff で **added problem 0** (baseline 125) / 規約 lint 8 本 errors=0 / slot 11 不変 / side-channel 12ch 不変
(_justDeclaredAxId 不動・新 globalThis 無し)。
**決定論検証 (load-bearing)**: ① 移送 body の md5 が元 slice と EOL 正規化後一致。② **独立 verifier**: git HEAD 原本から
5 sub-file + 2 barrel を再構築し、各 file が HEAD の対応 slice と diff=空 (EOL 正規化後)。③ 旧 export 集合 ⊆ barrel 再 export
集合 を機械 parse で確認 (公開縮小 0)。④ git diff の touched file が想定集合のみ。

## 本 phase スコープ外 → Phase 3e (新設) へ繰り延べ → **3e で裁定済 (2026-06-22)**
- useEngineDispatch の runEngineAction 分離 (+ `_justDeclaredAxId` の globalThis 化 or accessor 化)。
- EngineAction の family サブ union 「型化」+ 両 switch への `default:never` exhaustiveness ガード追加
  (挙動隣接編集ゆえ switch 網羅性ゲートとセットで設計)。
- **→ 3e 結論**: 着手前フルパネルレビュー (opus 4 lens, 4/4 minimal) で **default:never ガードのみ ADOPT**。
  runEngineAction 分離=DROP (barrel 490<500 で size 動機ゼロ + axId cross-module 化 BUG-034 category)、
  axId globalThis化=DROP (slot 逆行)、family 型化=SUBSUMED (full-union default:never が member-drop 全捕捉)。詳細 phase-3e-design.md。
