# 次セッション再開プロンプト (2026-05-11 末時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

---

```
名探偵コナンTCG MVP の実装を継続してください。

## 現在地

- リポジトリ: c:/Users/arumi/OneDrive/デスクトップ/conan
- 最新コミット: e63c5c5 feat(engine): invariants + integration round-trip test
- テスト状況: 308 PASS / 30 Test Files / typecheck 通過
- Phase 0-2 完了 (engine 基礎: read/mutate/invariant 構築済)

## やること

`.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md` の Phase 3 から実装を再開。

実行モード: subagent-driven-development (前セッションでユーザー選択した mode を維持)
→ superpowers:subagent-driven-development skill を起動し、各 task を fresh subagent に dispatch

## 開始手順

1. .claude/memory.md を読み現在地確認
2. .claude/sessions/2026-05-11-4.md で前セッション達成内容把握
3. .claude/research/plans/2026-05-11-mvp-implementation/phase-3-effect-resolver.md で Phase 3 詳細確認
4. subagent-driven-development skill 起動
5. Phase 3 タスクを 2-3 グループに分割して subagent に dispatch (推奨):
   - Group A: Hook Registry + Atom Verb ハンドラ (3.1-3.2)
   - Group B: Targeting + Cost + Condition + Dyn evaluator (3.3-3.6)
   - Group C: Effect Resolver + Effect Stack + Validator + 統合テスト (3.7-3.10)
6. 各 task 完了後 spec compliance review (haiku/sonnet 軽量 model 可)
7. Phase 3 完了で memory.md / sessions/2026-05-11-5.md 更新

## 重要な前提・制約

- 骨格凍結原則 (.claude/CLAUDE.md): カード効果対応のための骨格修正禁止
- 全 Markdown 100行以内 (超過時分割)
- TDD 必須 (test 先 → 失敗 → 実装 → PASS → commit)
- commit メッセージ末尾に「Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>」必須
- Engine API spec は .claude/specs/engine-api*.md (17 ファイル) に完全定義

## 残り全 Phase

- Phase 3: Effect Resolver + Hooks + Cost + Target + Cond + Dyn (~5h)
- Phase 4: Flow Control turn/phase/action/contact 9段階状態機械 (~4h)
- Phase 5: cards/_shared/ 9 + 47カード実装 (~12h)
- Phase 6: AI Random/Heuristic + 100戦 smoke (~2h)
- Phase 7: UI Shell + プレイマット (~4h)
- Phase 8: UI 相互作用 + モーダル群 (~4h)
- Phase 9: 1000戦 + チュートリアル + リリース判定 (~3h)

合計約34h。1セッション 30-60分なら Phase 3 全完了 + Phase 4 一部 程度を目標に。

context budget が苦しくなったら、前セッションと同様にチェックポイント (memory.md / sessions/2026-05-11-N.md 更新) してから停止。
```

---

## subagent-driven 実行のコツ (前セッション学習)

- **1 dispatch あたりのファイル数上限 ~7-9 程度**。それ以上は分割
- **TDD不要なタスク** (npm install, config 書き出し等) は spec review 省略可
- **TDD要のタスク** (engine ロジック) は test → 失敗 → 実装 → PASS の順を厳守させる
- **モデル選択**: 機械的タスク (config) は haiku、ロジック実装は sonnet、判断必要な設計は opus
- **同じ namespace の tasks はまとめる** (例: Phase 1.1+1.2 は同じ types、Phase 2.4-2.7 は同じ mutate)
- **spec reviewer は haiku で十分** (機械的チェック)、code quality review は実装ロジックがある時のみ
- **状態管理**: 各 dispatch 前に memory.md を最新化、dispatch 後 TodoWrite 更新

## 必要なドキュメント location

- 実装プラン: .claude/research/plans/2026-05-11-mvp-implementation/
- Engine API: .claude/specs/engine-api*.md (17)
- Card 分析: .claude/specs/cards-analysis/ (32 md)
- Card データ TSV: .claude/specs/cards-data/ (8 TSV + _raw/)
- 共通クラス: .claude/specs/shared-classes/ (8 spec + INDEX)
- ルール: .claude/rules/ (30)
- 規約: .claude/CLAUDE.md
