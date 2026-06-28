# Card Factory リスク階層化 — 実装プラン INDEX

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> または superpowers:executing-plans でタスク毎に実装。各 md は ≤100 行 (CLAUDE.md 規約)。
> 設計元: [../card-factory-risk-tiered-design.md](../card-factory-risk-tiered-design.md)

**Goal:** カード候補を T0(実証再利用)/T1(新規組合せ)/T2(新規機構) に決定論分類し、T0 を機械ゲートのみで
batch 出荷できる tooling を作り、1 session の出荷枚数を 5→30+ に上げる。

**Architecture:** 出荷済 ALL_CARDS の abilities を fingerprint 化して EXEMPLAR-SET を作る。候補 spec の
fingerprint (capability token 集合 + param 正規化 skeleton hash) を EXEMPLAR-SET と突合し階層判定。
T0 は skeleton 同型 → opus/certify 敵対を省き機械ゲートのみ。TSV literal↔DSL param 機械突合で誤写を fail-closed。

**Tech Stack:** Node.js `.cjs` (fingerprint/classify/crosscheck) + vitest (dump & unit test) + 既存 taskA パイプライン。

## Global Constraints (全タスク共通、spec から verbatim)

- **engine変更0**: T0/T1 カードは `node scripts/taskA-validate-specs.cjs` pass 必須 (engine0 機械証明)。
- **`速度<精度` 不破**: opus 判断は exemplar で支払い済 → 新規性ゼロ(T0)で再支払いしない。新規性は T1/T2 で必ず opus。
- **fail-closed**: crosscheck で未対応 literal / 不一致 → FAIL = T2 へ escalate (握り潰さない)。
- **EXEMPLAR-SET 純度**: 出荷済 (= main / CI green) カードのみを exemplar とする。
- **全 md ≤100 行**。code は `.cjs` (CommonJS)。closure(`<fn>`) を含む候補は自動的に T2。
- **TSV source**: `.claude/specs/cards-data/<pkg>/<kind>.tsv` を header-index で読む (列番号 hardcode 禁止、`.tmp/_fulltext.cjs` 準拠)。
- **git**: branch-first / 共有 workdir 注意 (branch 切替しない・自ファイルのみ add NOT -A) / `--no-verify`+8lint 手動緑 / FF push。

## File Structure

| ファイル | 役割 |
|---|---|
| `scripts/card-fingerprint.cjs` (新) | 純関数: abilities → {tokens[], skeletonHash}。T1 で再利用 |
| `tests/factory/dump-shipped.test.ts` (新) | ALL_CARDS → `.tmp/card-factory/shipped-abilities.json` |
| `scripts/build-exemplar-set.cjs` (新) | shipped-abilities → `.tmp/card-factory/exemplar-set.json` |
| `scripts/card-classify.cjs` (新) | 候補 specs → T0/T1/T2 + 件数表 |
| `scripts/card-text-crosscheck.cjs` (新) | TSV literal ↔ DSL param 突合、fail-closed |
| `tests/factory/*.test.ts` (新) | fingerprint/classify/crosscheck 単体テスト |
| `.claude/skills/card-wave/SKILL.md` (改) | T0/T1/T2 分岐を追記 |
| `.claude/specs/card-factory-state.md` (新) | onboarding 圧縮 (EXEMPLAR概要/次候補/gate ROI) |

## タスク順 (各々 独立テスト可)

1. [01-fingerprint.md](01-fingerprint.md) — fingerprint 純関数 + 単体テスト
2. [02-exemplar.md](02-exemplar.md) — 出荷 dump + EXEMPLAR-SET 構築
3. [03-classify.md](03-classify.md) — 階層分類器
4. [04-crosscheck.md](04-crosscheck.md) — TSV↔DSL 機械突合
5. [05-skill-batch.md](05-skill-batch.md) — card-wave skill T0/T1/T2 分岐 + 初回 T0 batch 実測

各タスク末尾で commit (branch-first, `--no-verify`+8lint, self-files-only add, FF push)。
タスク 1〜4 は engine/カード非変更の純 tooling → smoke/カード回帰に影響なし (tsc+vitest+対象単体テストのみで gate)。
