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

## 1c. テスト fixture 統一 (✅ 2026-06-12 実施)

- makeChar (32 定義/28 files) + sceneChar (33/33) + makeCtx (10/10) → `tests/helpers/fixtures.ts` に 3 関数
- 旧スキーマ fixture (named/sets/stacked — triggered.test.ts:58-66 等 4 ファイル) は現行 SceneCharacter
  スキーマに是正してから共通化 (stale 温存の共通化は禁止)
- 機械的置換だが 60+ ファイル touch → 専用フェーズ。置換は import 追加 + ローカル定義削除のみ (本文不変)

## 2a. PA 短縮形 gate 共通化 (✅ 2026-06-12 実施)

- `applyPaShortForm(s, verb, a, ctx, {sideDefault, chooser})` を atom-handlers 内 helper として抽出
  (sceneRemove/sceneSetState/sceneToHand/sceneToDeck/charModify*/charGrantKeyword/charGrantAbility/charSetCard)
- 各 case は「helper 呼出 + verb 固有の実行部」のみに。BUG-120 の chooser 規約 (controller=ctx.source.player)
  を helper に固定し、side=a.player 解決の規約を一本化 (sceneToHand の chooser=資料側ズレもここで統一)
- **実施時の計画補正**: chooser を controller に「固定」すると a.player=操作者 規約の 4 verb
  (sceneRemove/charRemoveSetCard/sceneToHand/sceneSetState、BUG-131 で正と裁定) の挙動が
  player:'opp' 系カードで変わるため不採用。helper は chooser/side を**明示引数**とし、
  2 規約の併存を helper doc に明文化 (挙動完全不変を優先)。対象は uid-carrier 11 verb。
  target-carrier 系 (discard/evidenceToHand/handAddFromRemove) と cardId-carrier (sceneEnter)、
  $pick.cardIds (charStackCard) は構造が異なるため対象外 (3a で再評価)

## 2b. 手動同期ペアの単一ソース化 (✅ 2026-06-12 実施)

- 対象 4 系統: AtomVerb union ↔ validate.ts ATOM_VERBS ↔ taskA-validate-specs VERBS /
  Cost union ↔ evaluate/pay/costToText ↔ COSTS / TRIGGERED_HOOKS ↔ HOOKS / Condition ↔ CONDS
- 方針: TS 側は `satisfies` + `Record<AtomVerb, …>` で **コンパイル時** 完全性を強制。
  cjs whitelist は「エンジンから JSON dump → cjs が読む」生成式 or 同期検証テスト (どちらか軽い方)
- pay.ts payInner の void 戻り (case 追加漏れが TS で検知されない — Task D で実証) に exhaustive check 追加

## 2c. dispatch 契約是正 (✅ 2026-06-12 実施)

- `declaredAbility`/`partnerAbility` の cost+ctx 構築 + pay を engine 側
  `flow/main/ability-activate.ts` (activateDeclaredAbility / activatePartnerAbility) に一元化。
  呼出元 (UI/AI/e2e) は `{type, uid, abilId, costParams?}` のみ渡す。BUG-116 経路の構造的解消
- costParams = picker 選択値 (flipFaceUpEvidence.indices / sceneToDeckBottom.uids / costChoice /
  choiceIndex) のみの最小 payload — 人間選択値は engine 内で再現不可のため action 引数に残す
- 同型契約 (effectPickResolve の optional 引数群) は 4 形態 union (skip/single/multi/switch) で明示

## 3a〜3d (高リスク群 — 着手前に個別設計レビュー必須)

- 3a (✅ 2026-06-22): atom-handlers 1828 行を barrel + _shared + core/scene/char/picks/**misc** に分割
  (計画 4→5 に補正: core に lifecycle/control verb を含めると <500 超過のため misc 分離)。
  extract-and-dispatch (case body 無改変・決定論 codemod)。byte-identity 52/52 検証。詳細 phase-3a-design.md / 下記レビュー記録。
- 3b (✅ 2026-06-22): pick-resolution の責務 3 分割 — resolve-picks.ts (849行) の pending管理 (連続ブロック
  L166-467) を新 pending-state.ts へ verbatim 移送し、resolve-picks=walk / pending-state=pending /
  apply-pick=continuation に分離。旧 public pending API は barrel 再export で importer 改変0。BUG-054〜121 を
  walk/pending/continuation の 3 group に分類した回帰テスト棚卸し (phase-3b-test-inventory.md)。詳細
  phase-3b-design.md / 下記レビュー記録。決定論 codemod + 独立 byte-identity 検証 (vs git HEAD)。
- 3c (✅ 2026-06-22): globalThis side-channel 縮減。**調査補正** (read/write 全サイト直読み): 計画 5ch のうち 3ch
  (ChoiceResume/OptionalResume=cross-dispatch holder [apply-pick が dispatch ごと新規 ctx 構築] /
  OptionalSide=store-drain+cross-module read [stack.ts:121/apply-pick:454] / DeckReveal/Reorder=store-drain) は
  globalThis が load-bearing → **KEEP**。安全 2ch のみ実施: ① __chainStepNoApply → ctx.dyn.chainStepNoApply
  (intra-produce、resolver chain case のみ読む。同一 run-tree ctx 素通し)。② __pendingEffectChoiceBindings を
  __pendingEffectChoiceResume holder の {effect,bindings} 格納形に統合 (pending-state.ts 内部のみ・export 不変・null-safe)。
  declare-global slot 13→11 / side-channel lint 13→12。着手前フルパネル設計レビュー (opus 4 lens) で BLOCKER 1
  (null-unsafe take/clear) + MAJOR 群を解消。詳細 phase-3c-design.md / 下記レビュー記録。
- 3d: useActionsPanelFlow の enum/run 分離 + cost-builder 抽出、useEngineDispatch の action union 型化

## 4. 周辺整理

- scripts/survey 4 本を `scripts/_archive/` へ / specs 2026-05-11 系 13 本の現行性検証 → stale は
  `specs/_archive/` / `_reuse/index.ts` のコメント規約統一 / sessions・reports のアーカイブ方針決定

## レビュー記録

全フェーズのレビュー記録 (指摘・解消・検証結果) は [review-records.md](review-records.md) に分割
(本ファイルの 100 行制約超過のため 2026-06-12 移設)。
