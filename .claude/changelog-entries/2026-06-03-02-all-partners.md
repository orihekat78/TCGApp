---
date: 2026-06-03
title: 全パートナーカード (非MVP 276枚) を generator で実装・registry 登録
type: feature
scope: cards
---

## 全パートナーカード実装

`.claude/specs/cards-data/*/partner.tsv` の全パートナー (~280枚) のうち、未実装だった**非MVP 17パッケージ 276枚**を CardDef stub として実装し registry に登録した。MVP (ct-d08/ct-d11、4枚) は不変。

- **generator**: `scripts/gen-cards/gen-partners.cjs`。各 partner.tsv を読み `src/cards/<pkg>/<cardNum>.ts` (D08001 同型、`abilities:[]` stub) を生成、集約 barrel `src/cards/_generated/partners.ts` (`GENERATED_PARTNERS: CardDef[]`) を出力。TSV 更新で再実行可能。
- **variant 別ファイル**: parallel art (`B01001` / `B01001P` / `B01001Sec1` …) も別 cardId = 別ファイル。
- **個別能力は後日**: 全 partner を共通能力 (アシスト / 事件解決、engine 内蔵) のみの `abilities:[]` で stub 化。個別能力を持つ ~22枚 (ct-p05 / pr-01) は TODO コメントを残し後日実装。
- **registration**: `src/cards/index.ts` で `GENERATED_PARTNERS` を import + `ALL_CARDS` に spread (+276)。`GENERATED_PARTNERS` を `@/cards` から re-export。
- **registry**: `ALL_CARDS` 47 → **323枚** (partner 4 → 280)。重複 id なし。

## 検証

- tsc clean (276 生成ファイル含む) / 重複 id ゼロ / vitest **1654 PASS** / smoke 1000戦 例外0 (502/498 不変、新 partner は deck 未使用)。
- **stale count-lock テスト修正**: MVP 47枚をハードコードしていた registry.test / validate-all.test / phase5-smoke.test の枚数アサーション (47 / 青26 / 黄21) を、MVP baseline + `GENERATED_PARTNERS` 由来の delta を加算する形に変更。generator 再実行に自動追従しつつ MVP drift は検出可能。
