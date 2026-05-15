# アーキテクチャ研究 (research/arch)

実装基盤の選定・設計判断のための調査結果。
このディレクトリ内のファイルは相互に参照し合うので、横断的に読むこと推奨。

## ファイル一覧

| # | ファイル | 内容 |
|---|----------|------|
| 01 | [01-frameworks-survey.md](arch/01-frameworks-survey.md) | フレームワーク選定調査 (boardgame.io 等) |
| 02 | [02-effect-stack-patterns.md](arch/02-effect-stack-patterns.md) | 効果スタック (MTG/Hearthstone 比較) |
| 03 | [03-state-management.md](arch/03-state-management.md) | GameState 管理 (Immer 等) |
| 04 | [04-card-dsl-patterns.md](arch/04-card-dsl-patterns.md) | カード効果 DSL パターン |
| 05 | [05-cpu-ai-patterns.md](arch/05-cpu-ai-patterns.md) | CPU AI 設計 (Random/Heuristic/MCTS) |
| 06 | [06-test-strategy.md](arch/06-test-strategy.md) | テスト戦略 |
| 07 | [07-serialization-replay.md](arch/07-serialization-replay.md) | シリアライズ / リプレイ |
| 08 | [08-interrupt-priority-windows.md](arch/08-interrupt-priority-windows.md) | 割り込み・優先権ウィンドウ |
| 09 | [09-maintenance-operations.md](arch/09-maintenance-operations.md) | 運用・保守 |
| 10 | [10-ai-playback-visualization.md](arch/10-ai-playback-visualization.md) | AI 再生・可視化 |

## 関連 specs

- [engine-api](../../specs/engine-api.md) — 本研究結果を反映した実装API設計
- [ui-effect-stack](../../specs/2026-05-11-ui-effect-stack.md) — 02 の UI 反映
- [shared-classes/INDEX](../../specs/shared-classes/INDEX.md) — 04 の DSL 共通クラス

## 関連 rules

- [15-abilities-effects](../../rules/15-abilities-effects.md) — 02・03 と整合
- [22-qa-action-contact](../../rules/22-qa-action-contact.md) — 08 の根拠

## ナビゲーション

- ↑ [HUB.md](../../../HUB.md) — プロジェクト全体ナビ
- ↑ [research/](../) — 研究ディレクトリ
