# リファクタリング各フェーズ詳細 (根拠 = 2026-06-12 棚卸し調査)

## 1a. mutate 層バイパスの直書き排除 (✅ 2026-06-12 実施)

- 対象 (調査で確定した全 5 箇所):
  - `flow/contact.ts:187` — 変装の元キャラ deck.push 直書き → `mutate.deck.toBottom` へ (レビュー指摘①で確定)
  - `flow/main/hand-use-card.ts` hand.splice 直書き ×2 → `mutate.hand` 経由
  - `flow/main/next-hint.ts` hand.splice 直書き ×2 → `mutate.hand` 経由
- 不変条件: splice/push と同一の配列操作になること (順序・index 保存)。full vitest + smoke baseline で担保
- レビュー結果: §レビュー記録 参照

## 1b. dead code 除去 (✅ 2026-06-12 実施)

- `__pendingActionExpansion` side-channel: push のみで消費者ゼロ (grep 確認済、E4 で turnEffects 直読みに統一済)。
  `expandActionTargets` verb 自体は印字カード 3 枚 (D11007/B01028/B05071) が target-expander の **静的 walk**
  で参照するため **handler の side-channel push のみ** 削除し、verb は no-op log 化 (additive 互換)
- `charSetAP` / `charSetLP` throw stub: レビューで削除を **却下** — 意図された誤用ガード
  (atom-handlers.test.ts:493-513 が throw を仕様として固定、survey が set-exact verb の将来需要を記録)。
  「実装されるまで throw で誤用検知」が設計意図のため存置

## 1c. テスト fixture 統一

- makeChar (32 定義/28 files) + sceneChar (33/33) + makeCtx (10/10) → `tests/helpers/fixtures.ts` に 3 関数
- 旧スキーマ fixture (named/sets/stacked — triggered.test.ts:58-66 等 4 ファイル) は現行 SceneCharacter
  スキーマに是正してから共通化 (stale 温存の共通化は禁止)
- 機械的置換だが 60+ ファイル touch → 専用フェーズ。置換は import 追加 + ローカル定義削除のみ (本文不変)

## 2a. PA 短縮形 gate 共通化

- `applyPaShortForm(s, verb, a, ctx, {sideDefault, chooser})` を atom-handlers 内 helper として抽出
  (sceneRemove/sceneSetState/sceneToHand/sceneToDeck/charModify*/charGrantKeyword/charGrantAbility/charSetCard)
- 各 case は「helper 呼出 + verb 固有の実行部」のみに。BUG-120 の chooser 規約 (controller=ctx.source.player)
  を helper に固定し、side=a.player 解決の規約を一本化 (sceneToHand の chooser=資料側ズレもここで統一)

## 2b. 手動同期ペアの単一ソース化

- 対象 4 系統: AtomVerb union ↔ validate.ts ATOM_VERBS ↔ taskA-validate-specs VERBS /
  Cost union ↔ evaluate/pay/costToText ↔ COSTS / TRIGGERED_HOOKS ↔ HOOKS / Condition ↔ CONDS
- 方針: TS 側は `satisfies` + `Record<AtomVerb, …>` で **コンパイル時** 完全性を強制。
  cjs whitelist は「エンジンから JSON dump → cjs が読む」生成式 or 同期検証テスト (どちらか軽い方)
- pay.ts payInner の void 戻り (case 追加漏れが TS で検知されない — Task D で実証) に exhaustive check 追加

## 2c. dispatch 契約是正

- `declaredAbility` の cost+ctx 構築を useEngineDispatch 内 (engine 側 API でも可) に移し、
  呼出元 (UI/AI/e2e) は `{type, uid, abilId, costParams?}` のみ渡す。BUG-116 経路の構造的解消
- 同型契約 (effectPickResolve の optional 引数群) も union 型で required/optional を明示

## 3a〜3d (高リスク群 — 着手前に個別設計レビュー必須)

- 3a: atom-handlers 分割 (re-export で外部 API 不変)。3b: pick-resolution の責務 3 分割
  (walk / pending管理 / continuation) + BUG-054〜121 を意味 group 化した回帰テスト棚卸し。
- 3c: __pendingEffectChoiceBindings / OptionalSide / OptionalResume / DeckRevealSide / chainStepNoApply
  を continuation・EffectCtx へ (UI 境界 3 channel は存置)。3d: useActionsPanelFlow の enum/run 分離 +
  cost-builder 抽出、useEngineDispatch の action union 型化

## 4. 周辺整理

- scripts/survey 4 本を `scripts/_archive/` へ / specs 2026-05-11 系 13 本の現行性検証 → stale は
  `specs/_archive/` / `_reuse/index.ts` のコメント規約統一 / sessions・reports のアーカイブ方針決定

## レビュー記録

- **1a+1b (2026-06-12)** 厳格レビュー (反証観点の自己レビュー + 実コード裏取り) — 指摘 3 件、全て反映:
  ① contact.ts:187 の置換先は scene.toDeckBottom では**ない** — それは scene から splice する primitive
    で、変装はキャラが scene に残る (uid 維持 cardId 入替)。正は `mutate.deck.toBottom` (push と byte 同一)
  ② expandActionTargets の verb 削除は不可 — 印字カード 3 枚 (D11007/B01028/B05071) の def を
    target-expander が静的 walk で読むため verb は declarative marker として必要。dead なのは
    handler の side-channel push のみ → push のみ除去し handler を log no-op 化 + stale コメント 2 箇所是正
  ③ charSetAP/LP throw stub の削除を却下 (上記 1b 参照 — テストで仕様固定された意図的ガード)
  検証: typecheck clean / full vitest **1961 pass / 0 fail** / smoke:1000 **baseline 完全一致**
  (469/531, avg 10.86 — 挙動不変の直接証拠) / e2e 17 pass (engine-extensions + task-d-extensions)
