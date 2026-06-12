---
name: card-wave
description: Use when implementing a batch/wave of cards (green候補刈り取り、certify、taskA パイプライン、engine拡張カード解禁) — カードの一括追加・DSL authoring・カード検証ゲートを行うとき。
---

# card-wave — カード実装 wave 実行手順

**opus 主体** (オーケストレーション・実作業)。fable は難判断のみ: certify の adversarial verify /
カードテキスト⇔DSL の意味等価判定 / ルール裁定解釈。sonnet は機械 lens (whitelist 照合・diff 突合) のみ。

## 1. 着手前

- working tree clean を確認 → branch (例: `cards/wave2-cluster1`)。main 直 commit 禁止
- 対象選定: `node scripts/taskA-next-chunk.cjs` + `.claude/specs/catalog-survey-2026-06-06/`
  (green候補マスタ) + [DEFERRED-INDEX.md](../../specs/DEFERRED-INDEX.md) (除外済みを再選定しない)
- 同一 engine パターン 5〜10 枚を 1 クラスタに。engine 拡張が要るものは混ぜない (別クラスタ)
- capability の正本は `capability-map.txt` (card-impl-engine-gates.md は stale)

## 2. 根拠確定 (certify) — 最重要

- **green候補は未certify なら信用しない** (実証元の誤り例: B01011)。全句を公式テキスト⇔
  `.claude/rules/` ⇔実 engine コードで裏取り。`scripts/wf-certify.mjs` (grounding→adversarial verify、
  verify lens は `model:'fable'`)。verdict は `.tmp/certify/<rep>.json` に durable 保存
- yellow / cost 解釈疑義は実装せず DEFER (DEFERRED-INDEX へ理由付き追記)
- member ごとに TSV から実テキスト再取得 (signature は色/数/名を抽象化している)

## 3. 実装

- `taskA-collect-greens.cjs` → `taskA-validate-specs.cjs` (whitelist 照合) →
  `taskA-codegen.cjs --write` → `taskA-register.cjs` (_reuse/index.ts は手編集しない)
- カードファイル冒頭にルール参照コメント必須 / touched files > 3 で設計見直し
- [card-addition-checklist.md](../../specs/card-addition-checklist.md) を必ず通す

## 4. DSL の罠 (必読 — 全部実バグ由来)

| 罠 | 規則 |
|---|---|
| pick carrier | **短縮形必須**。明示 `uid:'$pick'`+target は human 経路で bind 喪失 (BUG-130) |
| on-hand triggered | `trigger.selfOnly: true` 必須 (BUG-032) |
| hand/remove/deck からキャラを pick | `kind:'character'` 必須 (イベント混入、BUG-123) |
| 「カットイン/変装等を持つキャラ」filter | `filter.keyword:'カットイン'` 等 (keywords[] に無い、BUG-122) |
| 量指定子 | 「〜枚まで」=0可 / 「〜する」=必須 / 「〜してもよい」=skip可 (rules/15) |
| 新 verb/cond/cost/hook | union+map+cjs whitelist の3点同期 (sync-taskA-whitelists.test.ts が落ちて教えてくれる) |
| event-use closure 必須のイベント | codegen 対象外 — DEFER (JSON シリアライズ維持) |

## 5. 検証ゲート (全部、この順)

1. `node scripts/taskA-validate-specs.cjs` (engine変更0 の機械保証)
2. `npx tsc --noEmit` → `npx vitest run` (full、baseline から件数減なし)
3. `npm run smoke:1000` → `npm run check:smoke-baseline` (engine変更0 なら baseline 不変が証跡)
4. `npx playwright test` 回帰 suite
5. **playwright MCP で実機検証 (第一選択、e2e spec 新作はその後)**: 1試合通し +
   「画面処理 = カードテキスト文言」を **decoy を盤面に置いて** 1対1 確認 (BUG-117/118 教訓)、
   console error 0
6. `npm run pre-commit` (docs:check + 規約 lint 8本)

## 6. 記録 → commit

- memory.md / session log / changelog-entries (`<date>-<seq>-<slug>.md` 手書き →
  `npm run docs:changelog`) / 新規バグは BUG-XXX.md 起票 / DEFER は DEFERRED-INDEX
- **`npm run docs` は全 .md 編集後の最後に 1 回** → 明示 add → commit
  (`feat(cards): wave#N clusterM — <パターン> X枚 (engine変更0)` + Co-Authored-By) →
  main ff-merge → **push** (2026-06-12 ユーザー許可済) → CI green 確認 (`gh run list -L1`)
- commit hook の指示に従い NEXT-SESSION-PROMPT 更新 + /clear 推奨でターンを閉じる

## コスト注意

certify は 1rep ≈ 200k tokens・窓毎 ~20rep が上限 (SUB=8 直列で throttle 回避)。
窓を跨ぐ場合は `.tmp/certify/` の durable 保存から再開する。
