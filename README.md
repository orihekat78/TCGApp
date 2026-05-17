# 名探偵コナンTCG Web アプリケーション

ローカルで「人間 vs CPU」「CPU vs CPU」が遊べる、
名探偵コナントレーディングカードゲーム（タカラトミー公式）の **個人利用限定** Webアプリ。

> ⚠️ 本プロジェクトは個人利用・私的使用に限定された非公式ファンプロジェクトです。
> 公開・配布は行いません。
> © 青山剛昌／小学館 © TOMY

## 現在の状況（2026-05-17）

**Phase 5 advance engine 4 sub-feature 達成** ✅ 1 セッションで 9 commits を一気通貫:
SceneSwitch (engine+AI+UI) / Hirameki E2E / Misread E2E / Souza atom 新規実装。
listener bug 2 件発見・修正、React 19 fiber static flag 解消。
1000戦 smoke は **0 timeout / 0 例外 / 勝率 52.4 vs 47.6 (baseline 完全維持)**。

### MVP 実装プラン進捗 ([詳細](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md))

| Phase | 内容 | 状態 |
|------|-----|-----|
| 0-6 | Engine + 47 カード + AI | ✅ 完了 |
| 7 + 7.5 | UI Shell (12 components + cardResolvers + App 統合) | ✅ 完了 |
| 8.1-8.10 + 完全クローズ | hooks / per-step dispatch / Hirameki / 各種 modal / E2E | ✅ 完了 |
| 9-A | 1000戦 smoke baseline ([smoke-2026-05-17.md](.claude/reports/smoke-2026-05-17.md)) | ✅ 完了 |
| 9-B | engine 4 バグ修正 + Heuristic チューニング + hotfix (node:fs 分離) | ✅ 完了 |
| 9-C | カード画像 UI 統合 (CardArt + useCardImage) | ✅ 完了 |
| 9-D | case 向き auto-detect / partner 拡大 / hand 色あせ / Remove 画像 / Evidence↔FILE swap | ✅ 完了 |
| 9-E | deck low-stock / FILE progress-7 完了 / opp 手札 mini back 統一 | ✅ 完了 |
| Phase 5 advance prep | [guardrails spec](.claude/specs/2026-05-17-phase5-advance-guardrails.md) 起草 (`5cdc3bb`) | ✅ 完了 |
| Phase 5 advance: SceneSwitch | rules/20 §スイッチ engine + AI + UI (`6625283` / `1421772`) | ✅ 完了 |
| Phase 5 advance: Hirameki | rules/10 E2E 結合 + listener bug fix (`75fe5f4`) | ✅ engine 完了 |
| Phase 5 advance: Misread | rules/13 §ミスリード E2E (Human defender) + bug fix (`9070556`) | ✅ engine 完了、UI 残 |
| Phase 5 advance: Souza | rules/13 §捜査X engine atom + AI auto-order (`59183f4`) | ✅ engine 完了、Sub-task B/C 残 |
| 9-F〜H | AI 強化 (MCTS) / リプレイ / パフォーマンス計測 | ⏳ |

### テスト状況

- **1434 PASS / 189 Test Files** (Phase 5 advance engine 完了時点、最新 `59183f4`)
- 1000戦 AI vs AI smoke (heuristic × heuristic): **0 invariant failure / 0 例外 / 0 timeout / 3.x s**
  - A 勝率 52.4% / B 勝率 47.6% / 平均 10.35 ターン (Phase 9-A baseline 完全維持、5 連続 commit で regression 0)
- `npm run typecheck` 通過 / `npm run docs:check` クリーン
- `npm run dev` で http://localhost:5173/ — 公式 CDN 画像付きの人間 vs CPU が end-to-end でプレイ可能、SceneSwitch UI 配線済
- 骨格凍結原則: Phase 5 advance の engine 修正は §例外「Phase 5 で延期された基本機能の完成 / バグ修正」に該当

### 調査フェーズ完了済 (実装の前提)

ルール集 (Ver 2.4 + Q&A 30ファイル) / 法務スタンス / カードデータ取得方法 /
アーキテクチャ判断 / UX設計 / チュートリアル設計 / UI仕様 16ファイル /
カード分析 47枚 / 共通クラス候補 9 / Engine API spec 17ファイル

詳細: [.claude/specs/INDEX.md](.claude/specs/INDEX.md), [.claude/research/](.claude/research/)

## プロジェクト要件

- **対象ゲーム**: 名探偵コナントレーディングカードゲーム（タカラトミー公式・2024〜）
- **MVP対象デッキ**:
  - CT-D08「青の古城探索事件」(Case-ThemeDeck 03)
  - CT-D11「千速と重悟の婚活パーティー」(Case-ThemeDeck 06)
- **技術スタック**: TypeScript 5 + React 18 + Vite + Immer + Vitest + Zustand
- **アーキテクチャ**: 純粋ロジック Engine (React 非依存) + Effect Descriptor DSL + Hook 機構
- **CPU AI**: Random / Heuristic 切替（将来 MCTS）
- **将来スコープ**: 全カード対応

## ドキュメント構成

- **[HUB.md](HUB.md)** — 🔍 全ドキュメントへのナビゲーションハブ（Obsidian推奨）
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — プロジェクト規約（骨格凍結原則 / 設計レビュー手順）
- [.claude/memory.md](.claude/memory.md) — 現セッション作業ログ
- [.claude/rules/INDEX.md](.claude/rules/INDEX.md) — 公式ルール集 (Ver 2.4 + Q&A裁定 + フロアルール)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md) — Engine API / UI / カード分析 全 spec
- [.claude/research/plans/2026-05-11-mvp-implementation/](.claude/research/plans/2026-05-11-mvp-implementation/) — MVP 実装プラン (10 Phase)
- [.claude/sessions/](.claude/sessions/) — 過去セッションのアーカイブ
- [.claude/auto/README.md](.claude/auto/README.md) — 🤖 自動生成ドキュメント運用ガイド（Phase 2以降でAPI/state/flows/progress/mappingを生成）

### Engine ソース ([src/engine/](src/engine/))

`engine.read` / `mutate` / `invariant` / `event` / `effect` / `dyn` / `target` /
`cost` / `cond` / `resolve` / `flow.{setup,runAutoPhase,main,action,contact,actionCase,guard,handUseCard,nextHint,partner,declared,reasoning,endTurn}` の
namespace 構成。詳細は [HUB.md](HUB.md) と [.claude/auto/](.claude/auto/) の自動生成 API ドキュメント参照。

## 法務スタンス（重要）

- **完全ローカル限定運用**（個人PC内のみ）
- カード画像はリポジトリ非同梱・実行時公式サイトから取得・キャッシュ
- 公開ホスティング・GitHub公開（カード画像同梱）禁止
- 詳細: [.claude/research/legal/04-recommendation.md](.claude/research/legal/04-recommendation.md)

## 開発ガバナンス

- 全Markdownファイル 100行以内
- 作業時は `.claude/memory.md` に必ず追記
- 骨格凍結原則: カード効果のための engine 修正禁止 → `cards/_shared/` に共通クラスで吸収
- ユーザーレビュー前に Claude 自身が **セルフレビュー + 水平展開調査** を実施
- 詳細: [.claude/CLAUDE.md](.claude/CLAUDE.md)

## このREADMEの運用

各 Phase 完了時に「現在の状況」テーブルとテスト状況を更新する。
