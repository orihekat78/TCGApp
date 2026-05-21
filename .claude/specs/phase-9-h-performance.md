# Phase 9-H: パフォーマンス計測

## 目的

`phase-9-polish.md` Task 9.2 の「1試合 100ms 以内 (engine のみ)」を spec 化し、
継続的にパフォーマンス回帰を検知する基盤を導入する。

具体目標:

- **1 turn ≤ 100ms** (engine のみ、UI 抜き) を baseline 目標として明文化
- 1000 戦 smoke 実行時に **per-turn duration の p50 / p95 / p99 / max** を集計
- `npm run benchmark` で profile-enabled smoke を起動

## 既存資産

- **scripts/smoke/run-1000.ts** (191 行): seed ベースの 1000 戦 smoke。`durationMs` を per-game で記録
- **scripts/smoke/aggregate.ts** (155 行): pure aggregator。`Summary.p50Turns / p95Turns` (ターン数の percentile) を計算済
- **scripts/smoke/format-md.ts**: Markdown レポート生成
- **src/ai/match.ts**: `runMatch` driver、`MatchResult.movesPerTurn: number[]` を返却
- **tests/smoke/aggregate.test.ts**: aggregate の unit 9 ケース既存

これらを最小限拡張する (engine 本体修正なし)。

## 設計

### 1. Per-turn timing 記録

`src/ai/match.ts`:

- `MatchOpts.profile?: boolean` (default false)
- `MatchResult.turnDurationsMs?: number[]` (profile=true 時のみ)
- 内部ループで `perf_hooks.performance.now()` を `playTurn` 前後で取得し、push

骨格凍結原則: engine 本体 (`src/engine/*`) は無編集。match.ts は AI driver layer なので OK。

### 2. Smoke / Benchmark CLI 拡張

`scripts/smoke/run-1000.ts`:

- `--profile` flag を accept
- `--profile` 指定時に `runMatch({ profile: true })` を渡し、`GameRecord.turnDurationsMs` に保存

`scripts/benchmark/run.ts` (新規):

- 内部で run-1000.ts のロジックを `profile: true` 固定で呼ぶ
- `npm run benchmark` script に紐付け

### 3. Aggregate 拡張

`scripts/smoke/aggregate.ts`:

- `GameRecord.turnDurationsMs?: number[]` 追加
- `Summary` に以下を追加 (profile データがあるときのみ計算、無いとき undefined):
  - `avgTurnMs?: number`
  - `p50TurnMs?: number`
  - `p95TurnMs?: number`
  - `p99TurnMs?: number`
  - `maxTurnMs?: number`
- 全 records の `turnDurationsMs` を flat 配列にして percentile 計算
- 既存 `percentile()` 関数を再利用

### 4. Markdown 表示

`scripts/smoke/format-md.ts`:

- `Summary.p50TurnMs` が定義されているときのみ「ターン処理時間」セクションを追加表示
- 例: `| ターン処理時間 p50/p95/p99/max | 0.2ms / 0.5ms / 1.1ms / 8ms |`

### 5. Unit テスト

`tests/smoke/aggregate.test.ts`:

- 既存 9 ケースを保持
- 新規 `profile データ無し → avgTurnMs 等は undefined`
- 新規 `profile データあり → avgTurnMs / p50 / p95 / p99 計算正しい`
- 新規 `複数 records の turnDurationsMs を flatten して percentile`

## ルール網羅性チェック

該当無し: Phase 9-H はパフォーマンス計測のみで rules/ に影響しない。

## エッジケース列挙

1. **profile=false の records** → turnDurationsMs undefined、percentile 計算しない
2. **records[].turnDurationsMs = []** (0 ターンで終了) → flatten 結果 空 → percentile 0 返却 (既存 percentile が空配列 0 を返すため互換)
3. **records 全件が profile=true だが turns=0** → 全 turnDurationsMs 空 → 同上
4. **records 混在** (profile=true と profile=false) → 一部のみが flatten 対象 → 0 件と扱う？ → 一律 undefined にする方針 (profile flag は全体 on/off で扱う)
5. **invariant-fail で途中終了** → turnDurationsMs 部分配列 (途中まで) → 計上対象 (profile mode の意図と合致)

## 水平展開

- `src/ai/match.ts` の `runMatch` のみ profile 対応。他の driver (UI playTurn 等) は対象外
- UI 側でも将来的に profile したい場合は別 issue

## 状態完備性

新規 state field 無し (in-memory aggregate のみ)。

## 検証

- `npm run typecheck` 緑
- `npm test -- tests/smoke/aggregate.test.ts` 緑 (既存 9 + 新規 3)
- `npm test` 全件緑 (1493 → ~1496)
- `npm run smoke:1000` smoke 525/475 baseline 維持
- `npm run benchmark` 出力で p50/p95/p99 が表示
- `npm run docs:check` clean

## Out of Scope

- engine 内部の細粒度 profiling (resolver dispatch / effect application 別) — Phase 9-I 候補
- UI playTurn の profile — 別 issue
- Bottleneck 特定後の最適化 — Phase 9-I 候補

## 関連

- 親 spec: `.claude/research/plans/2026-05-11-mvp-implementation/phase-9-polish.md` Task 9.2
- 既存 smoke: `scripts/smoke/*`
- Plan: `C:\Users\arumi\.claude\plans\jiggly-watching-lake.md` Phase 9-H 節
