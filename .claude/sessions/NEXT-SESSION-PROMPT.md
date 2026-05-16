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
- Phase 8.6α/β Commit 1 (`eb21e8c`) — GuardPickerModal + CutInDisguisePickerModal UI 単体 (9 tests) ✅
- **Phase 8 完全クローズ Commit 2 (`770624e`) — per-step action dispatch + useContactFlowDriver (12 tests) ✅**
  - actionDeclareChar/Case / actionGuard / actionContact / actionAdvance / actionJudge を追加
  - activeActionId slice (useGameStateStore) で driver 駆動
  - Playmat に driver + 2 モーダルホスト mount
  - runActionFlow を per-step に差し替え
- **Phase 8 完全クローズ Commit 2.5 (`62fa8b2`) — playTurn pauseOnAction + useOppTurnDriver per-step contact (6 tests) ✅**
  - policy.ts: PlayTurnOptions { pauseOnAction } / PlayTurnResult.paused 追加
  - useOppTurnDriver: paused 分岐で actionDeclareChar/Case dispatch → useContactFlowDriver に委譲
  - useEffect deps に activeActionId 追加 — action 完了で続きの move 再開
  - CPU 攻撃時に GuardPickerModal が自動 open
- **Phase 8 完全クローズ Commit 3a (`5d1620d`) — Hirameki end-to-end (9 tests) ✅**
  - engine/listeners/hirameki.ts 新規 — evidence:remove-by-action listener
  - pendingHirameki slice + hiramekiResolve dispatch + 側チャネル drain
  - useHiramekiFlowDriver / HiramekiPickerModal / AI chooseHiramekiTrigger
- Phase 9a-1 / 9a-2 / 9b / 9c チュートリアル L0-L13 ✅
- ベース: 1348 PASS / 173 files / typecheck clean / docs:check clean

## 残タスク (この続きでやる作業)

### Commit 3b — Misread モーダル (~6 tests, engine work 含む)

**前提**: Misread (rules/13) は engine 側に reasoning:before-add listener が未登録 (Phase 5 タスク)。
Commit 3a (Hirameki) と同パターンで:

- `src/engine/listeners/misread.ts` 新規: `reasoning:before-add` で両側 scene の active ミスリード持ち抽出
- 側チャネル `_pendingMisreadSideChannel = { reasoningUid, candidates: { uid, x }[] }`
- `useGameStateStore.pendingMisread` slice
- `MisreadPickerModal` (複数選択可: rules/13 「1 推理に複数枚同時」)
- `dispatchEngineAction({type:'misreadResolve', picks: uid[]})` で各キャラを sleep + LP-X 効果適用
- AIPolicy.chooseMisreadTriggers (LP削り最大化ヒューリスティック)

### Commit 4 — Souza / SceneSwitch モーダル (~5 tests)
- engine 側で推理発動時 / 証拠リムーブ時のフック点を確認 (`pendingEffects` か `event.emit`)
- `MisreadConfirmModal` / `HiramekiConfirmModal` 新規
- driver 拡張: 該当イベントで self 側モーダル発火

### Commit 4 — Souza / Switch モーダル (~5 tests)
- `SouzaReorderModal`: 公開 N 枚を ▲▼ 並び替え
- `SceneSwitchModal`: 現場 5 枚から 1 体ピック
- `pendingEffects` 解決と統合

### Commit 5 — 8.8 効果スタック reorder UI (~8 tests)
- `EffectStackPanel.tsx` に同所有者効果の `ownerChosenOrder` 設定 UI (▲▼)
- 「解決中」ロックインジケータ
- engine dispatch `setOwnerChosenOrder(entryId, order)`

### Commit 6 — 8.11 統合 E2E + 回帰検証 (~6 tests)
- `tests/integration/human-vs-ai-playthrough.test.tsx`: setup → 推理 → アクション → CPU 応答 → 勝利条件
- 既存 CPU パス回帰確認

## 作業手順

1. `.claude/CLAUDE.md` 規約・ルール参照義務を確認
2. `git log --oneline -5` で最新 commit `770624e` 確認 (Commit 2 完了済)
3. Commit 2.5 から順次実装。各 commit で:
   - 新規 test → GREEN
   - 全体 vitest / typecheck / docs:check clean
   - memory.md 更新 + commit
4. 全 commit 完了後 `git push origin main`

## エッジケース (CLAUDE.md §設計レビュー)
- CPU が attacker かつ human の guard 候補 0 件 → driver で skip + advance
- アクション継続性 (rules/22 条件途中失効でも継続)
- MR 重複登場 (scene switch 中の自動リムーブ)
- 同所有者同タイミング効果 0/1 件時 reorder UI 非表示
- gameResult セット後 全 dispatch no-op (driver 冒頭ガード済)
```

---

## 参考

- 直近 commit: `5d1620d` (Commit 3a — Hirameki end-to-end)
- 既存 driver: `src/ui/hooks/useContactFlowDriver.ts`
- 既存 modal store: `src/ui/hooks/useContactModalStore.ts`
- Phase 8 原 spec: `.claude/research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md`
- 既存 modal: `src/ui/components/{GuardPickerModal,CutInDisguisePickerModal}.tsx`
