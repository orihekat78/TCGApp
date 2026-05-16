# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP の Phase 8 完全クローズ作業の続き。

## 完了状態 (2026-05-16 push 済)

- Phase 7 / 7.5 / 8.1〜8.5 / 8.6 (推理/ネクストヒント/アシスト/事件解決/手札使用) ✅
- Phase 8.7 a-e (CPU アクション宣言 + コンタクト応答) ✅
- Phase 8.8 a-d (パートナー / 宣言能力 / cost 解決 / AI 統合) ✅
- Task 8.4 / 8.4b (ゲーム開始モーダル + 正規 turn-1 setup) ✅
- Phase 8.10 全 (OppTurnOverlay / Toast / 登場アニメ / contact-judge log / ContactFlash / 証拠バンプ / 退場 fade / スタンプ反転 / Refresh / Victory) ✅
- Phase 8.6α/β Commit 1 (`eb21e8c`) — GuardPickerModal + CutInDisguisePickerModal の UI 単体 (9 tests) ✅
- Phase 9a-1 / 9a-2 / 9b / 9c チュートリアル L0-L13 ✅
- ベース: 1321 PASS / 166 files / typecheck clean / docs:check clean

## 残タスク (この続きでやる作業)

承認済プラン: `~/.claude/plans/drifting-imagining-duckling.md`

### Commit 2 — engine 統合 (state.activeAction + per-step dispatch)
- `GameState` に `activeAction?: ActionContext | null` 追加
- `createEmptyGameState` で `activeAction: undefined` 初期化
- `useEngineDispatch` に新型を追加:
  - `actionDeclareChar(byUid, targetUid)` — declare して activeAction セット
  - `actionDeclareCase(byUid, targetPlayer)` — 同上 (case)
  - `actionGuard({ guarderUid: string | null })` — tryGuard or passGuard
  - `actionContact({ kind: 'cutin'|'disguise'|'pass', player, cardId? })`
  - `actionAdvance()` — advance 単発
  - `actionJudge()` — snapshotAP + judge + advance × 2
- `useContactFlowDriver` hook 新規: activeAction の phase を監視し、defender が self なら GuardPickerModal を開き、opp なら HeuristicPolicy で自動進行
- 既存 `resolveActionAgainstChar` (action-resolution.ts) は CPU vs CPU 用に残す
- 既存 `runActionFlow` (useActionsPanelFlow) を新 dispatcher に差し替え
- 新規 ~12 tests (driver FSM + 各 dispatch)

### Commit 3 — Misread / Hirameki モーダル
- engine 側で推理発動時 / 証拠リムーブ時のフック点を確認 (`pendingEffects` か `event.emit`)
- `MisreadConfirmModal` / `HiramekiConfirmModal` 新規
- driver 拡張: 該当イベントで self 側モーダル発火
- 新規 ~4 tests

### Commit 4 — Souza / Switch モーダル
- `SouzaReorderModal`: 公開 N 枚を ▲▼ 並び替え
- `SceneSwitchModal`: 現場 5 枚から 1 体ピック
- `pendingEffects` 解決と統合
- 新規 ~5 tests

### Commit 5 — 8.8 効果スタック reorder UI
- `EffectStackPanel.tsx` に同所有者効果の `ownerChosenOrder` 設定 UI (▲▼)
- 「解決中」ロックインジケータ
- engine dispatch `setOwnerChosenOrder(entryId, order)`
- 新規 ~8 tests

### Commit 6 — 8.11 統合 E2E + 回帰検証
- `tests/integration/human-vs-ai-playthrough.test.tsx`: setup → 推理 → アクション → CPU 応答 → 勝利条件
- 既存 CPU パス回帰確認
- 新規 ~6 tests

## 作業手順

1. `.claude/CLAUDE.md` 規約・ルール参照義務を確認
2. プラン (`~/.claude/plans/drifting-imagining-duckling.md`) を再読
3. Commit 2 から順次実装。各 commit で:
   - 新規 test → GREEN
   - 全体 vitest / typecheck / docs:check clean
   - memory.md 更新 + commit
4. 全 commit 完了後 `git push origin main`

## エッジケース (CLAUDE.md §設計レビュー)
- 0 候補時のスキップ (guard / cutin / souza X 枚未満)
- アクション継続性 (rules/22 条件途中失効でも継続)
- MR 重複登場 (scene switch 中の自動リムーブ)
- 同所有者同タイミング効果 0/1 件時 reorder UI 非表示
- gameResult セット後 全 dispatch no-op
```

---

## 参考

- 承認済プラン: `~/.claude/plans/drifting-imagining-duckling.md`
- 現状コード把握: `git log --oneline -10` で最新 commit `eb21e8c` から確認
- Phase 8 原 spec: `.claude/research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md`
- 既存 modal 雛形: `src/ui/components/{GuardPickerModal,CutInDisguisePickerModal}.tsx`
