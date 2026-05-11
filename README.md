# 名探偵コナンTCG Web アプリケーション

ローカルで「人間 vs CPU」「CPU vs CPU」が遊べる、
名探偵コナントレーディングカードゲーム（タカラトミー公式）の **個人利用限定** Webアプリ。

> ⚠️ 本プロジェクトは個人利用・私的使用に限定された非公式ファンプロジェクトです。
> 公開・配布は行いません。
> © 青山剛昌／小学館 © TOMY

## 現在の状況（2026-05-11）

**実装フェーズ進行中**。Engine 骨格 (Phase 0-3) 完了。

### MVP 実装プラン進捗 ([詳細](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md))

| Phase | 内容 | 状態 |
|------|-----|-----|
| 0 | プロジェクトブートストラップ | ✅ 完了 |
| 1 | 型・GameState・RNG・Immer | ✅ 完了 |
| 2 | engine.read / engine.mutate / invariant | ✅ 完了 |
| 3 | Effect Resolver + Hooks + Cost + Target + Cond + Dyn | ✅ 完了 |
| 4 | Flow Control (turn/phase/action/contact) | ⏳ 次 |
| 5 | cards/_shared/ 9 + 47カード (CT-D08 + CT-D11) | ⏳ |
| 6 | AI (Random / Heuristic) | ⏳ |
| 7 | UI Shell + プレイマット | ⏳ |
| 8 | UI 相互作用 + 動的モーダル | ⏳ |
| 9 | 統合・自動プレイテスト1000戦・チュートリアル | ⏳ |

### テスト状況

- **529 PASS / 42 Test Files** (Phase 3 終了時点)
- `npx tsc --noEmit` 通過
- 骨格凍結原則遵守: `src/engine/mutate/` 編集なし

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

### Engine ソース ([src/engine/](src/engine/))

| Namespace | 役割 |
|-----------|------|
| `engine.read` | 純粋セレクタ (turn/player/scene/char/def/game/log) |
| `engine.mutate` | Immer draft 上の primitive (deck/hand/scene/char/evidence/file/...) |
| `engine.invariant` | 不変条件チェック (case/partner/stun semantics 等) |
| `engine.event` | Hook on/emit/queue + EffectStackEntry 自動 wrap |
| `engine.effect` | Atom dispatcher / DSL Resolver / Validator |
| `engine.dyn` | `$self.ap` / `$contact.X` / `$cost.X` / `$dyn.X` 動的式評価 |
| `engine.target` | 候補列挙 + 選択検証 (rules/19 split-name + distinctNames) |
| `engine.cost` | canPay / pay (viaCost フラグ管理) |
| `engine.cond` | 26 Condition variants 評価 |
| `engine.resolve` | Effect Stack (queue/next/runOne/runAllUntilEmpty + cancel/replace/lock) |

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
