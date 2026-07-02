# 速度リバランス方針 (2026-07-02 user_request — 「精度過剰で開発速度が遅い」是正)

2026-05-21 user_request #2「速度 < 精度」の**一律適用を撤回**し、リスク連動 tier 制へ移行する。
精度の床は機械ゲート (CI) が担保し、トークンを食う「エージェントによる検証」だけを変更リスクに連動させる。

## 診断: どこで時間が溶けていたか (直近 6 wave + card wave 実測)

| # | コスト源 | 実測 | 判定 |
|---|---------|------|------|
| 1 | opus 4-lens 敵対 review を全 wave 一律 | 評価器 (cond/dyn) wave は BLOCKER 0・NIT のみ。真 BLOCKER は配線型 (wave-4 emit 網羅 / wave-6 honor site) のみ | 変更種別で lens 数を tier 化可 |
| 2 | per-card certify ≈200k tok を clone にも全数 | P-clone・決定表 clone は機械 diff で照合可能 | exemplar のみフル certify |
| 3 | 1 wave = 1 session = 1 commit | session 起動 overhead (規約+状況再読) が小 wave (1-5 prim) 毎に発生 | wave 大型化 + 1 session 複数 wave |
| 4 | Playwright を card/機能 round 一律 | 新 UI 部品「型」が生えない card は既存経路の再踏 | UI 部品型単位に限定 |
| 5 | multi-vote / perspective-diverse opus 補償 | 低リスク判断にも適用されがち | T3 のみ |

## 新方針: 3-tier ゲート

**不変の床 (全 tier 共通、機械・トークン零)**: tsc 0 / vitest baseline / smoke:1000 winsA 不変 /
8 lint err0 / CI green。probe test (TDD) も全 tier 必須 — 精度の実体はここ。

| Tier | 対象 | 敵対 review | Playwright |
|------|------|------------|-----------|
| **T1 低** | pure-additive evaluator (cond/dyn/turn-flag/配線1点 observer)・出荷済 exemplar の clone カード | **0** (self-review で不安があれば 1 lens) | 無し |
| **T2 中** | 新 verb (pick/UI surface)・observer emit 多点配線・WRITE 側・新 filter field・family exemplar カード | **2 lens** (semantic + edge-test) | 新 UI 部品**型**が生えた時のみ 1 回 |
| **T3 高** | matchOneFilter 等 hot-path・resolver/queue・flow core・GameState 形状・MR・P10 alt勝敗 | 現行フル **4 lens** | probe 必須 |

tier 判定は wave 冒頭で 1 行宣言 (例: `tier=T1 根拠: state直読 cond のみ、既存 path 不変`)。迷ったら 1 つ上。

## バッチ化ルール

- **wave サイズ**: T1 = 8〜15 prim or 20〜40 card / 1 commit。T2 = 3〜6。T3 = 単独。
- **1 session 複数 wave 可** (context 60% まで)。NEXT-SESSION-PROMPT 更新は session 末 1 回。
- **certify-lite**: pattern family ごとに exemplar 1 枚フル certify → 残 clone は決定表 diff
  (DSL フィールド ⇔ TSV 印字列の機械照合スクリプト) + 10 枚に 1 枚 spot-check。
- **bug budget**: post-ship バグは BUG-XXX 運用で回収 (ローカル専用アプリ、破壊的リスク無し)。
  smoke/CI/probe が回帰の床。「出荷前に全て潰す」から「機械が守る範囲は出荷後回収」へ。
- **stale 再採寸は維持**: 着手前 origin/main 実 grep は安い割に誤作業を大きく防ぐ → 継続。

## 維持するもの (緩めない)

- grounding (カード印字テキスト全列 ⇔ DSL 突合) — 誤セマンティクスは smoke で捕まらないため。
- 骨格凍結原則・T3 のフル検証・機械 6 ゲート・BUG 管理・DEFERRED-INDEX 記録。

## 期待効果 / KPI

- tok/card: ≈200k → 30〜50k。session あたり出荷 3〜4 倍。
- 毎 session 末に CHANGELOG エントリへ「出荷枚数 / 残枚数」1 行 (burn-down 可視化)。
- 回帰指標: post-ship BUG 発生率が smoke/CI で拾えない類型で月 5 件を超えたら tier 境界を 1 段戻す。

## 関連

- 全カード完了計画: [all-cards-completion-plan-2026-07-02.md](all-cards-completion-plan-2026-07-02.md)
- engine 拡張 driver: [engine-extension-plan-2026-06-30.md](engine-extension-plan-2026-06-30.md)
- 規約反映: [CLAUDE.md](../CLAUDE.md) 「開発時のレビュー手順 (リスク連動)」
