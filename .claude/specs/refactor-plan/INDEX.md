# 全体リファクタリング計画 (2026-06-12 起案、ユーザー指示)

目的: 長年蓄積した無駄 (dead code / twin-path / 手動同期 / コピペ / 肥大ファイル) を
**挙動不変** を保証しながら段階的に除去する。根拠は 2 本の棚卸し調査 (engine/cards 系 + UI/scripts/tests 系、
2026-06-12 Explore agents、全項目 file:line 裏取り済)。

## 原則 (全フェーズ共通)

1. **挙動不変ゲート**: 各ステップ後に typecheck + full vitest + (flow 変更時) smoke:1000 baseline 一致 +
   e2e 回帰 0。1 ステップ = 1 関心事 (混ぜない)
2. **厳格レビュー**: 各フェーズ完了時に敵対レビュー (変更 diff を「反証する」観点で別 agent / 自己レビュー
   チェックリスト)。review 指摘は同フェーズ内で解消してから次へ
3. 骨格凍結原則との整合: リファクタは「動作不変な内部最適化」として凍結例外に該当
4. コミット単位: 1 フェーズ = 1 commit (Phase 0 で既存作業を先に commit してから着手)

## フェーズ一覧 (詳細: [phases.md](phases.md))

| Phase | 内容 | リスク | 状態 |
|-------|------|--------|------|
| 0 | 前提: Task A/D 未コミット分の commit (ユーザー操作、main なので branch first) | - | ⏳ ユーザー |
| 1a | mutate 層バイパスの直書き排除 (contact/hand-use-card/next-hint の 5 箇所) | 低 | ✅ 2026-06-12 |
| 1b | dead code 除去 (__pendingActionExpansion / charSetAP・charSetLP throw stub) | 低 | ✅ 2026-06-12 |
| 1c | テスト fixture 統一 (makeChar/sceneChar/makeCtx 75 定義 → tests/helpers/ 3 本) | 低 | ✅ 2026-06-12 |
| 2a | PA 短縮形 gate の共通 helper 化 (atom-handlers 内 ~7 コピペ → 1、~200 行減) | 中 | ✅ 2026-06-12 |
| 2b | 手動同期ペアの単一ソース化 (AtomVerb/Cost/HOOKS の union ↔ Set ↔ whitelist) | 中 | ✅ 2026-06-12 |
| 2c | dispatch 契約是正 (declaredAbility の cost+ctx を dispatcher 内で構築) | 中 | ✅ 2026-06-12 |
| 3a | atom-handlers.ts 分割 (1828 行 → barrel + _shared + core/scene/char/picks/misc) | 高 | ✅ 2026-06-22 |
| 3b | pick-resolution 再設計 (resolve-picks/apply-pick/resolver の BUG パッチ 15+ 件を意味整理) | 高 | ⏳ |
| 3c | globalThis side-channel 縮減 (8 → continuation/EffectCtx 統合可能な 5 を移設) | 高 | ⏳ |
| 3d | UI hooks 分割 (useActionsPanelFlow 921 行 / useEngineDispatch 29 case) | 高 | ⏳ |
| 4 | 周辺整理 (scripts 棚卸し / specs stale 検証 / _reuse 規約統一 / sessions アーカイブ) | 低 | ⏳ |

## 数値ターゲット

| 指標 | 現状 | 目標 |
|------|------|------|
| atom-handlers.ts 行数 | 1,391+ | < 500/ファイル × 4 |
| PA 短縮形コピペ | ~7 箇所 | 1 helper |
| 手動同期ペア | 4 系統 (AtomVerb/Cost/HOOKS/conds) | テスト or 生成で機械検証 |
| テスト fixture 定義 | 75 (28+33+10 ファイル) | 3 (tests/helpers/) |
| globalThis channel | 12 | ≤ 7 |
| mutate バイパス直書き | 5 箇所 | 0 |

## カード wave との挟み込み順 (ユーザー承認 2026-06-12)

**① commit (Phase 0) → ② Phase 1c〜2c → ③ カード wave#2 (green候補刈り取り + engine拡張 wave#2) → ④ Phase 3〜4**。
理由: 2a/2b/2c は次のカード wave で踏む罠 (carrier bind 喪失 / whitelist 同期漏れ / cost 未払い) の
再発防止そのものでカード実装を安くする。Phase 3 (大規模分割) は wave#2 後で良い。
コピペ用プロンプト: [.claude/NEXT-SESSION-PROMPT.md](../../NEXT-SESSION-PROMPT.md)

## 実行順とレビュー記録

- Phase 1a/1b: 本セッション実行 (詳細・レビュー結果: [phases.md](phases.md) §1a/§1b)
- Phase 1c 以降: 次セッション以降。各フェーズ着手前に本 INDEX の状態列を更新すること
- 中断・再開時は「原則 4 (1 フェーズ 1 commit)」を厳守し、フェーズ途中の混在 commit を作らない
