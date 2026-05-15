# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP の Phase 8.6 残部分 (アシスト + 事件解決 → 手札使用 →
パートナー能力 / 宣言能力 → アクション宣言) に着手します。

## 開始前に必ず読むファイル (順序通り)

1. `.claude/CLAUDE.md` — プロジェクト規約 (骨格凍結原則 / メモリ運用 / README 義務)
2. `.claude/memory.md` — 現状サマリ + 未コミット作業の場所
3. `.claude/sessions/2026-05-15-6.md` — 直前セッション (ネクストヒント完了 + アシスト RED 中断)
4. `.claude/sessions/2026-05-15-5.md` — その前 (Phase 8.5 polish + 推理フロー)
5. `.claude/research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md` — Phase 8 詳細プラン

## 現在の状態

- Phase 0-7 + 7.5 + 8.1-8.5 + 8.6 (推理 + ネクストヒント) 完了
- 1191/1191 tests pass / typecheck clean / docs:check clean
- 最新 commit: `21b3b9f` Phase 8.6 ネクストヒントフロー UI 統合
- ブラウザ動作: 推理 / ネクストヒント / endTurn が end-to-end 動作 (`npm run dev` → 5177)

## 未コミット作業 (中断時点)

- `tests/ui/hooks/useActionsPanelFlow.assist.test.ts` (RED 9 件)
  - runAssistFlow × 4 / runSolveCaseFlow × 5
- impl 未着手 — sessions/2026-05-15-6.md の「再開時の impl プラン」を参照

## 最初にやること

1. `npx vitest run tests/ui/hooks/useActionsPanelFlow.assist.test.ts` で RED 確認
2. `src/ui/hooks/useEngineDispatch.ts` の EngineAction に `assist` / `solveCase` 追加
3. `src/ui/hooks/useActionsPanelFlow.ts` に runAssistFlow / runSolveCaseFlow 追加
4. ActionsPanel に「アシスト」「事件解決」item 追加 + Playmat 配線
5. GREEN → typecheck / docs → commit (Commit F)
6. 続けて 手札の使用 (Commit G)

CLAUDE.md「開発時の厳格レビュー手順」(セルフレビュー + 水平展開) を遵守してください。
```

---

## 補足: プロンプトを短くしたい場合 (最小版)

```text
名探偵コナンTCG Phase 8.6 残部分着手。`.claude/memory.md` から開始し、
`.claude/sessions/2026-05-15-6.md` の「再開時の impl プラン」に従って
アシスト + 事件解決 (RED 9 件あり、impl 未) を完成させてください。
1191 PASS、npm run dev でブラウザ表示可。
```
