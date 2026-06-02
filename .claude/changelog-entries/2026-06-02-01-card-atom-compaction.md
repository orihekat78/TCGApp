---
date: 2026-06-02
title: カード atom コンパクト化 + コーディング規約制定 + 短縮形 ATOM_PICK_SPEC 一本化
type: refactor
scope: engine / cards / docs
---

## 規約制定

- `.claude/specs/card-authoring-convention.md` — 1ステップ=1行 atom / comment-above / 短縮形優先 / 冗長 choice 除去 / closure は最終手段。
- `.claude/specs/card-condition-catalog.md` — `Condition.kind` 早見表 (アイコン→kind + 実カード例 + 追加手順)。
- 既存 `engine-api-{conditions,effect-descriptor,atom-verbs}.md` / `card-addition-checklist.md` から相互リンク。

## engine: 短縮形の一本化 (動作不変 refactor + 新 verb)

- `src/engine/effect/atom-pick-spec.ts` 新設: `ATOM_PICK_SPEC` テーブル (pick系 atom 短縮形の唯一の権威ソース) + `buildShortFormPick()` + `isShortFormDelta()`。
- 分散していた短縮形ロジック (`resolve-picks.ts` の `PB_DEFAULT_PICK_AREA` / `atom-handlers.ts` の `defaultPickTarget` + PA 各分岐) をテーブル駆動に集約。byPlayer/guard は verb 毎に保持し動作不変。
- 新規 PA 短縮形: `sceneSetState` / `charModifyLP` / `sceneEnter`(area 指定) + `charModifyAP/LP` の dyn-delta 受理。
- characterization test (移行前 baseline) + 新 verb test を追加。3 lens の adversarial verification で動作不変を確認。

## cards: 全 non-partner カードを comment-above 1行形に統一

- B0 リファレンス9枚 + D11020 comment-above 化 / B1 D11005・D11013・D11015・D11016 / B2 D08019・D11003・D11009 (sceneSetState 短縮形) / B3 D11012 (charModifyLP 短縮形) / B4 D08024・D11014 (sceneEnter 短縮形) / B5 簡易8枚 (factory のみ=no-op)。
- 冗長 `choice→options:[atom]` を短縮形 atom に置換。closure / factory / description / メタデータは不変。
- パートナーカード (D08001/02, D11001/02) / `_shared/*.ts` factory 内部は対象外。

## ⚠ 重要な知見

- **dyn-delta (`delta:{dyn}`) を使う宣言能力 (D08026/D11021) は explicit `target` を保持**。短縮形は target を実行時構築するため AI 列挙時に `costPaid` 不在で dyn eval が throw する (per-card test は通るが smoke で 667 例外 → 中央検証で検出 → D11021 を explicit に戻して解消)。
- **単一 option choice の除去は実行結果不変** (resolver は `options[0]` を実行) だが、AI の seeded 列挙木が変わり smoke 決着分布が 471/529→502/498 に動く。choice-removal cards を revert すると 471/529 に戻ることを bisect で確認 (カード動作は byte 不変)。

## 検証

- typecheck clean / vitest 1665 PASS / smoke 1000戦 例外0・invariant-fail 0。
- 教訓: per-card test (隔離) は invariant/列挙系の回帰を見逃す → **full suite + smoke の中央検証が必須**。
