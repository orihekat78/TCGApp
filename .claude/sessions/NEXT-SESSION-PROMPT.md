# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Round 2 UI/UX 修正完了 (2026-05-18 / 最新 `664906c`)。
次の作業を開始したい。

## 完了状態

**Round 2: ユーザ報告 18 バグ全解消 ✅** 6 連続 commit:

- e61bb7f Batch 1-A: 8 バグ (startTurn 統一 / TopBar 動的 / UID 名前解決 / アシスト警告 / 引き直し UI)
- c09807e Batch 1-B: 手札 disabled 可視化 (FILE 不足/色制限 tooltip) / picker yellow glow + 「👆クリックして選択」/ picker stack auto-cancel
- 269eccc Batch 1.5: チュートリアル「次へ」 root cause (useStore.getState 直読み → subscription) 修正
- 07e47a1 Batch 2: 視覚 polish (枠色 35% / EVT-Lv overlay 削除 / scrollbar 隠 / PartnerArea 右下絶対 / opacity 0.85)
- 5e91bbe Batch 3a: ログパネル close button + ACTION_LABEL 日本語化 (23 keys)
- 664906c Batch 3b: CardListModal (FILE/証拠/リムーブ 共通) + 3 area onClick

## テスト状況 (現状ベースライン)

- **1436 PASS / 189 test files** / typecheck clean / docs:check clean
- 1000戦 smoke: heuristic × heuristic / 3.x s / **0 例外 / 0 timeout** / 524/476 baseline 完全維持 (6 連続 commit で regression 0)
- Playwright 実機検証: 全 18 バグ修正後の挙動確認済 + チュートリアル 33 step 完走

## 残課題 (本セッションで選んでください)

### Phase 5 advance UI 統合 (残)

1. **Misread UI**: useMisreadFlowDriver + PlaymatMisreadPickerModal wrapper (presentation 既存)
2. **Souza Sub-task B**: listener + side-channel `_pendingSouzaSideChannel` + dispatcher
3. **Souza Sub-task C**: useSouzaFlowDriver + PlaymatSouzaReorderModal wrapper (Human pick UI)
4. **「発見された」カード参照機構**: `state.discoveredCards` + `$discovered` placeholder

### Round 2 残検討 (低優先度)

- B-12 カード画像 CDN 解像度: 716×1000 既高解像度のため container 拡大不可 (no-fix 判断)
- B-15 デッキ event 0 枚: MVP デッキ構造 100% character (説明済、Phase 5+ で event カード追加検討)
- Round 2 全コミットを origin/main に push (現在 local main にのみ存在)

### Phase 9 継続

- **9-F**: HeuristicPolicy 強化 (MCTS / 重み付け scoring)
- **9-G**: ローカル保存・リプレイ (localStorage / IndexedDB)
- **9-H**: パフォーマンス計測 (ターン時間 / メモリ)

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認
2. `git log --oneline -10` で本セッションの 6 commits を確認
3. `.claude/sessions/2026-05-18.md` で Round 2 全容把握 (18 バグ詳細 + メタ原因 + 構造対応)
4. `~/.claude/plans/encapsulated-crafting-firefly.md` で Round 2 plan の全文確認
5. 上記候補から 1 つ選んで brainstorming → plan → 実装
6. UI 編集を含む場合は Playwright screenshot + console error 確認 必須

## エッジケース (CLAUDE.md §設計レビュー)

- engine 触る場合: §骨格凍結原則 §例外条件 を厳守
- 新カード追加時: touched files ≤ 3 制約
- UI 編集: prefers-reduced-motion 対応 / aria-label 維持 / React 19 fiber static flag 回避
- listener 追加時: `_reset*Registered` を必ず export
- Round 2 で新規追加された utility は再利用優先: uidNames.ts / handUseReason.ts / computeChapterTag / useMulligan / CardListModal
```

---

## 参考

- 直近 commit: `664906c` (Round 2 Batch 3b — FILE/証拠/リムーブモーダル) — local main のみ (未 push)
- ベース: 1436 PASS / 189 files / typecheck clean / docs:check clean
- 主要レポート:
  - `.claude/sessions/2026-05-18.md` — Round 2 全 18 バグ詳細 + メタ原因サマリ
  - `~/.claude/plans/encapsulated-crafting-firefly.md` — Round 2 plan
  - `.claude/reports/smoke-2026-05-18-{1..4}.{json,md}` — 1000戦 smoke レポート群
