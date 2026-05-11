# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: 設計完了 → MVP 実装プラン承認待ち → 実装フェーズへ
**直近成果物**:
- Engine API 17 spec (G1-G30 全取込済)
- カード分析 32 unique md / TSV 8ファイル + Q&A
- 共通クラス 9 spec
- MVP 実装プラン 11ファイル (約40時間想定)

## 次セッション開始時の最優先タスク

⭐ ユーザーが MVP プランを承認 → 実装フェーズ開始

### 実行モード選択 (writing-plans skill 提示)
1. **Subagent-Driven** (推奨): フレッシュ subagent / task / 二段レビュー
2. **Inline Execution**: executing-plans skill / バッチ + チェックポイント

実装は Phase 0 (ブートストラップ) から開始。
詳細プラン: [research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md)

## 過去セッションログ

- [2026-05-10](.claude/sessions/2026-05-10.md) — 法務調査・ルール抽出・MVP 決定
- [2026-05-11 (午前+昼)](.claude/sessions/2026-05-11.md) — UI 16 + Engine API 初版 + audit
- [2026-05-11-2 (午後1)](.claude/sessions/2026-05-11-2.md) — カード分析47枚 + TSV集約
- [2026-05-11-3 (午後2)](.claude/sessions/2026-05-11-3.md) — G23-G30 + 共通クラス + Q&A + MVPプラン

## 主要参照

- [.claude/specs/INDEX.md](.claude/specs/INDEX.md) — 全 spec 索引
- [.claude/specs/cards-data/INDEX.md](.claude/specs/cards-data/INDEX.md) — TSV (権威メタ + 公式テキスト + Q&A)
- [.claude/specs/cards-analysis/INDEX.md](.claude/specs/cards-analysis/INDEX.md) — 効果分析 32枚
- [.claude/specs/shared-classes/INDEX.md](.claude/specs/shared-classes/INDEX.md) — _shared 9クラス
- [.claude/specs/engine-api.md](.claude/specs/engine-api.md) — Engine API
- [.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md) — MVP 実装プラン
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 規約・骨格凍結原則
- [.claude/rules/INDEX.md](.claude/rules/INDEX.md) — 公式ルール 30件
