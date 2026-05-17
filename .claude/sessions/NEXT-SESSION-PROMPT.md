# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Phase 5 advance engine 4 sub-feature 達成 (2026-05-17 / 最新 `59183f4`)。
次の作業を開始したい。

## 完了状態

**Phase 5 advance engine 全 sub-feature 達成** ✅ 1 セッションで 9 commits 一気通貫:

- Phase 0-9-E 完全クローズ済
- 9-A〜9-E (`e4878ba`〜`76681f6`): 1000戦 smoke baseline + engine 4 バグ修正 + UI polish 一式
- Phase 5 advance prep (`5cdc3bb`): guardrails spec 起草
- C+D scope-out (`616272c`): sampleGameState cardId 正規化 + HandZone key 一意化 + cardResolvers idx 整合
- React 19 fix (`e79c0d0`): CaseArea Rules of Hooks 修正で "Expected static flag" 完全解消
- demo path 検証 (`321f4f2`): 17 CardArt 全 CDN 取得確認 (実装不要)
- SceneSwitch (`6625283` engine+AI / `1421772` UI): rules/20 §スイッチ 完全実装
- Hirameki E2E (`75fe5f4`): action[case] → listener → drain → fire/skip 経路全実証 + listener bug fix
- Misread E2E (`9070556`): Human defender 経路 6 件 + 同種 listener bug fix
- Souza engine (`59183f4`): rules/13 §捜査X engine atom + AI auto-order 新規実装

## テスト状況 (現状ベースライン)

- **1434 PASS / 189 test files** / typecheck clean / docs:check clean
- 1000戦 smoke: heuristic × heuristic / 3.x s / **0 例外 / 0 timeout** / 524/476 baseline 完全維持 (5 連続 commit で regression 0)

## 残課題 (本セッションで選んでください)

### Phase 5 advance UI 統合 (残)

1. **Misread UI**: useMisreadFlowDriver + PlaymatMisreadPickerModal wrapper (presentation 既存)
2. **Souza Sub-task B**: listener + side-channel `_pendingSouzaSideChannel` + dispatcher
3. **Souza Sub-task C**: useSouzaFlowDriver + PlaymatSouzaReorderModal wrapper (Human pick UI)
4. **「発見された」カード参照機構**: `state.discoveredCards` + `$discovered` placeholder (該当実カード追加時)

### Phase 9 継続

- **9-F**: HeuristicPolicy 強化 (MCTS / 重み付け scoring、SceneSwitch Option B/C / Souza 順番判定 / Misread greedy 改良)
- **9-G**: ローカル保存・リプレイ (localStorage / IndexedDB)
- **9-H**: パフォーマンス計測 (ターン時間 / メモリ)

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認
2. `git log --oneline -10` で本セッションの 9 commits を確認
3. `.claude/sessions/2026-05-17-4.md` で前セッション全容把握
4. `.claude/specs/2026-05-17-phase5-advance-guardrails.md` で残作業時の guardrails 確認
5. 上記候補から 1 つ選んで brainstorming → plan → 実装
6. UI 編集を含む場合は Playwright screenshot + console error 確認 必須

## エッジケース (CLAUDE.md §設計レビュー)

- engine 触る場合: §骨格凍結原則 §例外条件 (バグ修正 / 延期された基本機能完成 / ルール変更) を厳守
- 新カード追加時: touched files ≤ 3 制約
- UI 編集: prefers-reduced-motion 対応 / aria-label 維持 / React 19 fiber static flag 回避 (常時同一 JSX で返す)
- listener 追加時: `_reset*Registered` を必ず export (テスト分離のため、Hirameki/Misread の前例参照)
```

---

## 参考

- 直近 commit: `59183f4` (Phase 5 advance Souza engine atom) — origin/main 同期済
- ベース: 1434 PASS / 189 files / typecheck clean / docs:check clean
- 主要レポート:
  - `.claude/sessions/2026-05-17-4.md` — 本セッション 9 commits 詳細
  - `.claude/specs/2026-05-17-phase5-advance-guardrails.md` — Phase 5 advance ガードレール spec
  - `.claude/reports/smoke-2026-05-17-{2..5}.{json,md}` — 1000戦 smoke レポート群
