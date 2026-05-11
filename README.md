# 名探偵コナンTCG Web アプリケーション

ローカルで「人間 vs CPU」「CPU vs CPU」が遊べる、
名探偵コナントレーディングカードゲーム（タカラトミー公式）の **個人利用限定** Webアプリ。

> ⚠️ 本プロジェクトは個人利用・私的使用に限定された非公式ファンプロジェクトです。
> 公開・配布は行いません。
> © 青山剛昌／小学館 © TOMY

## 現在の状況（2026-05-11）

**調査フェーズ進行中**。実装はまだ開始していない。

### 調査の進捗

- ✅ ルール理解（公式マニュアル Ver 2.4 + 公式Q&A裁定）
- ✅ ルール完全検証（rule_manual.pdf実体取得 → 全27ページ突合 → 漏れ5件反映）
- ✅ プレイシート画像解析（7パネル）→ UI参考ドキュメント化
- ✅ 競技規定 rules/ 化（カード制限/エラッタ/フロアルール時間制限/誤プレイ処置）
- ✅ フェーズA: 法務調査（推奨スタンス確定）
- ✅ フェーズB: カードデータ取得方法・スキーマ設計
- ✅ フェーズC: アーキテクチャ調査（10ファイル）
- ✅ 動画解析: 字幕8本+スクショ2715枚取得・読込完了
- ✅ チュートリアル設計（カリキュラム/ステップ/視覚慣例）3ドキュメント
- ✅ 対戦UX設計（テンポ/物理マットUI化/確認動作/用語）4ドキュメント
- ✅ 公式UIモックアップ観察（FIbGuJWdwNw 3D CG）→ ux/14
- ✅ **UI設計仕様書 16ファイル**（プレイマット + 状態管理 + 操作フロー + エッジケース + スタイル）→ [specs/INDEX.md](.claude/specs/INDEX.md)
- ✅ **Obsidian セットアップ**（HUB.md + .obsidian/ 設定）
- ✅ **CLAUDE.md 拡張**（設計レビューチェックリスト + 骨格凍結原則）
- ✅ **骨格APIスペック設計 14ファイル**（read/mutate/effect-DSL/event/cost/target/cond/flow/resolve/card/edge/invariant）→ [specs/engine-api.md](.claude/specs/engine-api.md)
- ⏳ カード効果分析（CT-D08 + CT-D11 34枚）
- ⏳ 共通クラス設計
- ⏳ 実装プラン作成（writing-plans skill）
- ⏳ 実装

## プロジェクト要件

- **対象ゲーム**: 名探偵コナントレーディングカードゲーム（タカラトミー公式・2024〜）
- **MVP対象デッキ**:
  - CT-D08「青の古城探索事件」(Case-ThemeDeck 03)
  - CT-D11「千速と重悟の婚活パーティー」(Case-ThemeDeck 06)
- **技術スタック**: TypeScript + React + Node.js
- **ベースフレームワーク**: boardgame.io（部分採用）+ 自前効果スタック
- **CPU AI**: Random / Heuristic 切替（将来 MCTS）
- **チュートリアル**: 基本操作から複雑な相互作用まで網羅的に実装
- **将来スコープ**: 全カード対応

## ドキュメント構成

- **[HUB.md](HUB.md)** — 🔍 全ドキュメントへのナビゲーションハブ（Obsidianで開くと便利）
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — プロジェクト規約（Claude Code が必ず読む）
- [.claude/memory.md](.claude/memory.md) — 現在のセッション作業ログ
- [.claude/rules/INDEX.md](.claude/rules/INDEX.md) — 公式ルール集（Ver 2.4 + Q&A裁定）
- [.claude/research/](.claude/research/) — 設計判断のための調査結果
- [.claude/sessions/](.claude/sessions/) — 過去セッションのアーカイブ

### Obsidian で俯瞰（推奨）

プロジェクトルートを Obsidian vault として開くと、全ドキュメントのグラフビュー・バックリンク・即時検索が使えます。詳細: [.claude/research/obsidian-setup.md](.claude/research/obsidian-setup.md)

### 調査結果（`.claude/research/`）

- [legal/](/.claude/research/legal/) — 法務・著作権（推奨スタンス: 完全ローカル限定）
- [data/](.claude/research/data/) — カードデータ取得・スキーマ・画像・フォルダ構成
- [arch/](.claude/research/arch/) — アーキテクチャ（フレームワーク・効果スタック・状態・DSL・AI・テスト・シリアライズ・割り込み・運用・AI可視化）
- [ux/00-video-analysis-plan.md](.claude/research/ux/00-video-analysis-plan.md) — 動画解析の計画書
- [ux/01-caption-summary.md](.claude/research/ux/01-caption-summary.md) — 字幕取得結果・知見整理
- [ux/02-screenshot-priority.md](.claude/research/ux/02-screenshot-priority.md) — スクショ取得優先度
- [ux/10-match-rhythm.md](.claude/research/ux/10-match-rhythm.md) — 対戦テンポ
- [ux/11-physical-to-digital.md](.claude/research/ux/11-physical-to-digital.md) — 物理マットUI化指針
- [ux/12-confirmation-points.md](.claude/research/ux/12-confirmation-points.md) — 相互確認モーダル設計
- [ux/13-action-vocabulary.md](.claude/research/ux/13-action-vocabulary.md) — 用語/ログ表現統一
- [ux/14-official-ui-mockup.md](.claude/research/ux/14-official-ui-mockup.md) — 公式UIモックアップ観察（要・実装準拠）
- [tutorial/01-curriculum-design.md](.claude/research/tutorial/01-curriculum-design.md) — チュートリアル学習段階
- [tutorial/02-step-by-step-flow.md](.claude/research/tutorial/02-step-by-step-flow.md) — レッスン内部ステップ
- [tutorial/03-visual-conventions.md](.claude/research/tutorial/03-visual-conventions.md) — 演出/UI慣例
- [ui/playsheet-layout.md](.claude/research/ui/playsheet-layout.md) — 公式プレイシート由来のUIレイアウト参照
- [rules/commmune-wiki-map.md](.claude/research/rules/commmune-wiki-map.md) — commmune ナレッジベース構造マップ
- ui/ tutorial/ perf/ conan-specific/ — 後続フェーズで拡張

## 法務スタンス（重要）

- **完全ローカル限定運用**（個人PC内のみ）
- カード画像はリポジトリに同梱せず、実行時に公式サイトから取得しキャッシュ
- 公開ホスティング・GitHub公開（カード画像同梱）は行わない
- 詳細: [.claude/research/legal/04-recommendation.md](.claude/research/legal/04-recommendation.md)

## 開発ガバナンス

- 全Markdownファイルは100行以内
- 作業時は `.claude/memory.md` に必ず追記
- ユーザーレビュー前に Claude 自身が **セルフレビュー + 水平展開調査** を実施
- 詳細: [.claude/CLAUDE.md](.claude/CLAUDE.md)

## このREADMEの運用

調査・実装フェーズの進行に応じて随時更新する。
特に「現在の状況」のステータスは、各フェーズ完了時に更新すること。
