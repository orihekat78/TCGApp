# 🔍 名探偵コナンTCG プロジェクト — ナビゲーションハブ

このファイルは Obsidian で `Cmd/Ctrl + O` から開ける**プロジェクト俯瞰の出発点**。
すべての主要ドキュメントへのリンクが集約されている。

## 📌 まず最初に読む

- [README.md](README.md) — プロジェクト全体像 + 進捗
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 開発規約（Claude Code 必読）
- [.claude/memory.md](.claude/memory.md) — 現セッション作業ログ

## 📚 公式ルール（30ファイル）

- [INDEX](.claude/rules/INDEX.md) — 全ルールへの目次
- [出典](.claude/rules/sources.md)

### 基本ルール
- [01 勝利条件](.claude/rules/01-victory-conditions.md) ｜ [02 デッキ構築](.claude/rules/02-deck-construction.md) ｜ [03 場のエリア](.claude/rules/03-field-areas.md)
- [04 ゲーム準備](.claude/rules/04-game-setup.md) ｜ [05 ターン進行](.claude/rules/05-turn-phases.md) ｜ [06 カード種別](.claude/rules/06-card-types.md)
- [07 アクション](.claude/rules/07-action-flow.md) ｜ [08 コンタクト](.claude/rules/08-contact.md) ｜ [09 カットイン/変装](.claude/rules/09-cutin-disguise.md)
- [10 アクション事件](.claude/rules/10-action-event.md) ｜ [11 推理](.claude/rules/11-reasoning.md) ｜ [12 ネクストヒント](.claude/rules/12-next-hint.md)
- [13 キーワード](.claude/rules/13-keywords.md) ｜ [14 リフレッシュ](.claude/rules/14-refresh.md) ｜ [15 能力と効果](.claude/rules/15-abilities-effects.md)
- [16 セット/重ね](.claude/rules/16-card-set.md) ｜ [17 アイコン](.claude/rules/17-icons.md) ｜ [18 MR](.claude/rules/18-mr.md)
- [19 特殊効果](.claude/rules/19-special-rules.md) ｜ [20 色/スイッチ](.claude/rules/20-color-and-switch.md) ｜ [21 宣言能力](.claude/rules/21-declared-ability-cost.md)

### エッジケース Q&A
- [22 アクション/コンタクト](.claude/rules/22-qa-action-contact.md) ｜ [23 変装/カットイン](.claude/rules/23-qa-disguise-cutin.md)
- [24 名乗り/スタン](.claude/rules/24-qa-naming-stun.md) ｜ [25 効果解決](.claude/rules/25-qa-effects-resolution.md) ｜ [26 リフレッシュ](.claude/rules/26-qa-deck-refresh.md)

### 競技規定
- [27 カード制限](.claude/rules/27-card-restrictions.md) ｜ [28 エラッタ](.claude/rules/28-errata.md)
- [29 フロアルール時間](.claude/rules/29-floor-rule-timing.md) ｜ [30 不適切プレイ](.claude/rules/30-floor-rule-misplay.md)

## 🔬 調査・設計

### 法務
- [legal/04-recommendation](.claude/research/legal/04-recommendation.md) — 推奨スタンス確定

### データ層
- [data/01 取得方法](.claude/research/data/01-card-data-source.md) ｜ [02 スキーマ](.claude/research/data/02-card-schema-design.md)
- [03 画像](.claude/research/data/03-image-handling.md) ｜ [04 フォルダ構成](.claude/research/data/04-folder-structure.md)

### アーキテクチャ（10ファイル）
- [01 フレームワーク調査](.claude/research/arch/01-frameworks-survey.md) ｜ [02 効果スタック](.claude/research/arch/02-effect-stack-patterns.md)
- [03 状態管理](.claude/research/arch/03-state-management.md) ｜ [04 カードDSL](.claude/research/arch/04-card-dsl-patterns.md)
- [05 CPU AI](.claude/research/arch/05-cpu-ai-patterns.md) ｜ [06 テスト](.claude/research/arch/06-test-strategy.md)
- [07 シリアライズ](.claude/research/arch/07-serialization-replay.md) ｜ [08 割り込み](.claude/research/arch/08-interrupt-priority-windows.md)
- [09 運用](.claude/research/arch/09-maintenance-operations.md) ｜ [10 AI可視化](.claude/research/arch/10-ai-playback-visualization.md)

### UX/UI 設計
- [ux/14 公式UIモックアップ観察](.claude/research/ux/14-official-ui-mockup.md) — **★準拠ソース**
- [ux/10 対戦テンポ](.claude/research/ux/10-match-rhythm.md) ｜ [ux/11 物理→デジタル](.claude/research/ux/11-physical-to-digital.md)
- [ux/12 確認動作](.claude/research/ux/12-confirmation-points.md) ｜ [ux/13 用語](.claude/research/ux/13-action-vocabulary.md)
- [ui/playsheet-layout](.claude/research/ui/playsheet-layout.md) ｜ [ui/02 業界慣例](.claude/research/ui/02-industry-conventions.md)

### チュートリアル
- [tutorial/01 カリキュラム](.claude/research/tutorial/01-curriculum-design.md) ｜ [tutorial/02 ステップ](.claude/research/tutorial/02-step-by-step-flow.md)
- [tutorial/03 視覚慣例](.claude/research/tutorial/03-visual-conventions.md)

### コミュニティWiki
- [rules/commmune-wiki-map](.claude/research/rules/commmune-wiki-map.md)

## 🗂️ Obsidian 使い方
- [obsidian-setup](.claude/research/obsidian-setup.md) — プラグイン推奨・運用ヒント

## 📅 過去セッション
- [sessions/](.claude/sessions/) — 過去セッションアーカイブ

---

**Tips**: Obsidian で `Ctrl/Cmd + G` を押すとグラフビュー、`Ctrl/Cmd + O` でファイル即時検索、各ファイル右上のリンクアイコンでバックリンクを確認できます。
