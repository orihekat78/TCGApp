# Track B B0 — text→DSL compiler harness (corpus / shipped-DSL dump / oracle diff runner)

**Round/Phase**: 2026-07-02 二 Track 並行体制の Track B (カード追加ツール専任) 初回 session。
[compiler-track-plan-2026-07-02.md](../specs/compiler-track-plan-2026-07-02.md) の **B0 (harness、全部決定論 script、T1)** を出荷。
`src/engine/**` 変更 0 (骨格凍結 / Track A 衝突回避)。作業領域 = `scripts/compiler/**` + `tests/compiler/**` のみ。

## 成果物 (scripts/compiler/ 6 file)

1. **tsv-corpus.cjs** — `.claude/specs/cards-data/**/*.tsv` (83 file) → 印字全列の正規化 corpus。
   col10 effect + **col11/12/13 cutIn/hirameki/henso 必須** (ヒラメキ漏れ前科 B01075/B01089 のガード)。
   kind 別列構成 (character/event/partner/case) を header 名で吸収。CLI で `.tmp/compiler/corpus.json`。
2. **canonical.cjs** — 正規化 (key 昇順 / undefined 除去 / 関数→`<closure>` marker / keywords 順序吸収、
   abilities 順序は保持)。oracle 比較対象 = **abilities + keywords のみ** (stat 系は codegen 機械転記の守備範囲)。
3. **productions.cjs** — whitelist 文法 rule 集 (B0 = 空)。rule 契約 (`match`/`emit` + 出典コメント義務) を明文化。
4. **compile.cjs** — compiler 本体 skeleton。核心不変条件 = **未知句 1 つでも card 全体 refuse (partial 変換禁止)**。
   B0 の句分割は「非空テキスト列 = 1 句」の最粗粒度 (B1 で 【】〚〛/コスト境界/節 分割に置換)。
5. **dump-shipped.ts** — ALL_CARDS → canonical JSON (`.tmp/compiler/shipped-dsl.json`)。dup id は throw。
6. **oracle.cjs** — 3 値判定 (match / refuse / **mismatch** = silent 誤訳) + refuse 列別ヒストグラム +
   未実装分の compile 可能率 + `--gate` (G1: mismatch>0 → exit 1)。P variant (`B08004P`) は base printing へ写像。

## B0 受入実測 (production 0 件の素通し)

- corpus **2049 printings** (character 1441 / partner 280 / event 212 / case 116)、dup id 0、vanilla (全列空) 52。
- shipped **1509** (ALL_CARDS unique、closure 含み 249) — 計画値 1514 は約 5 枚過大 (棚卸手法差)。**残 540**。
- oracle: **judged 1509/1509 (noCorpus 0)** / mismatch 0 / match 52 = **vanilla のみ** /
  **text-bearing 1457 全 refuse (refuse 率 100%)** = 正常動作確認 ✔。

## 検証 (T1 = 機械ゲートのみ)

- tests/compiler **5 file / 30 test** (canonical 6 / compile 6 / oracle 7 / corpus 実 data 7 / oracle 実 data 4)。
  受入条件 (noCorpus=0 / mismatch=0 / match⊆vanilla) を `.tmp` 非依存の回帰テストとして固定 (CI 実行可)。
- gate: tsc 0 (both tsconfig) / vitest **3522 → 3552 pass** +1 skip / smoke:1000 **winsA=498** 不変・
  timeouts/exceptions 0 / 8 lint errors 0。
- 次: **B1** (句分割 + production rule 集 + 裁定テーブル → G1 = 1509 oracle で silent mismatch 0)。
