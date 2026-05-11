# 名探偵コナンTCG MVP 実装プラン INDEX (2026-05-11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ローカル限定 Web アプリで「人間 vs CPU」「CPU vs CPU」が遊べる、CT-D08 + CT-D11 (47枚) 対応の名探偵コナンTCG を MVP として動作させる。

**Architecture:** TypeScript モノリシック (1リポジトリ・1パッケージ)。Engine (state + DSL Resolver) は React 非依存の純粋ロジック。Card は CardDef を返す独立モジュール。UI は React + Vite。AI は Random/Heuristic 切替。Immer 経由 immutable state。

**Tech Stack:** TypeScript 5 + React 18 + Vite + Immer + Vitest + Zustand (状態保持) / cards/_shared 規約準拠。

## フェイズ構成

| # | フェイズ | 推定 | 詳細プラン |
|---|---------|------|----------|
| 0 | プロジェクトブートストラップ | 0.5h | [phase-0-bootstrap.md](phase-0-bootstrap.md) |
| 1 | 型・GameState・RNG | 2h | [phase-1-types-state.md](phase-1-types-state.md) |
| 2 | engine.read / engine.mutate | 4h | [phase-2-read-mutate.md](phase-2-read-mutate.md) |
| 3 | Effect Descriptor + Resolver + Hooks | 5h | [phase-3-effect-resolver.md](phase-3-effect-resolver.md) |
| 4 | Flow Control (turn/action/contact) | 4h | [phase-4-flow.md](phase-4-flow.md) |
| 5 | cards/_shared/ 9 + 47カード | 12h | [phase-5-cards.md](phase-5-cards.md) |
| 6 | AI (Random / Heuristic) | 2h | [phase-6-ai.md](phase-6-ai.md) |
| 7 | UI Shell + プレイマット | 4h | [phase-7-ui-shell.md](phase-7-ui-shell.md) |
| 8 | UI 相互作用 + 動的モーダル | 4h | [phase-8-ui-interactions.md](phase-8-ui-interactions.md) |
| 9 | 統合・自動プレイテスト1000戦・チュートリアル | 3h | [phase-9-polish.md](phase-9-polish.md) |

合計: 約40時間 (集中作業)。複数セッションに分散想定。

## 設計ソース (実装の参照元)

- **Engine API**: [.claude/specs/engine-api.md](../../../specs/engine-api.md) (17 ファイル)
- **Card Analysis**: [.claude/specs/cards-analysis/INDEX.md](../../../specs/cards-analysis/INDEX.md) (32 md / 47枚)
- **Card Data**: [.claude/specs/cards-data/INDEX.md](../../../specs/cards-data/INDEX.md) (8 TSV / 47枚)
- **Shared Classes**: [.claude/specs/shared-classes/INDEX.md](../../../specs/shared-classes/INDEX.md) (9 候補)
- **UI Specs**: [.claude/specs/INDEX.md](../../../specs/INDEX.md) (16 ファイル)
- **Rules**: [.claude/rules/INDEX.md](../../../rules/INDEX.md) (30 ファイル)
- **CLAUDE.md 規約**: [.claude/CLAUDE.md](../../../CLAUDE.md) (骨格凍結原則・共通クラス運用)

## 主要設計判断 (本プランで前提)

| # | 判断 | 根拠 |
|---|-----|------|
| D1 | 1リポジトリ・1パッケージ (monorepo 不要) | MVP 規模 |
| D2 | Engine は純粋ロジック (React 非依存) | テスト容易性 + AI による高速プレイ |
| D3 | Immer で state mutation | Engine API 仕様 |
| D4 | Effect Descriptor は JSON シリアライズ可能 | リプレイ・ネットワーク将来 |
| D5 | カード画像は実行時公式フェッチ | 法務スタンス (rules/) |
| D6 | UI: Vite + React 18 + Zustand (グローバル state) | 軽量 |
| D7 | テスト: Vitest (Vite 統合) | 高速 |
| D8 | AI: Random → Heuristic 切替。MCTS は将来 | MVP スコープ |
| D9 | TDD は engine/cards/AI に必須。UI は手動確認 + Storybook | 実用性 |

## 進行管理

- 各フェイズ完了時にユーザーレビュー
- Phase 5 (cards) 完了時に **自動プレイテスト 1000戦** で安定性確認
- Phase 9 完了時に MVP リリース判定

## 関連
- [../2026-05-11-ui-brainstorm.md](../2026-05-11-ui-brainstorm.md) — UI議事録
- [../../../specs/NEXT-SESSION-PLAN.md](../../../specs/NEXT-SESSION-PLAN.md) — 短期 ToDo
